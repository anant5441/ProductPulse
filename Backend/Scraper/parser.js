import * as cheerio from "cheerio";
import { z } from "zod";
import { SPACED_ELEMENTS } from "./constants.js";

const HeadingSchema = z.object({
    level: z.number().int().min(1).max(6),
    text: z.string(),
});

const LinkSchema = z.object({
    href: z.string(),
    text: z.string(),
});

const ImageSchema = z.object({
    src: z.string(),
    alt: z.string(),
});

export const PageContentSchema = z.object({
    title: z.string(),
    description: z.string(),
    canonical: z.string().nullable(),
    lang: z.string().nullable(),
    headings: z.array(HeadingSchema),
    links: z.array(LinkSchema),
    images: z.array(ImageSchema),
    scripts: z.array(z.string()),
    clientRendered: z.boolean(),
    meta: z.record(z.string(), z.string()),
    openGraph: z.record(z.string(), z.string()),
    text: z.string(),
});

function normalize(value) {
    return (value ?? "").replace(/\s+/g, " ").trim();
}

function resolveUrl(href, baseUrl) {
    if (!href) return null;
    try {
        return new URL(href, baseUrl).href;
    } catch {
        return href;
    }
}

export function parsePage(html, baseUrl = "") {
    const $ = cheerio.load(html);

    // grab the bundles before we strip the scripts: a shell that loads JS is the
    // difference between "page is empty" and "page is built in the browser"
    const scripts = $("script[src]")
        .map((_, element) => resolveUrl($(element).attr("src"), baseUrl))
        .get()
        .filter(Boolean);

    $("script, style, noscript, template, svg").remove();
    $("br").replaceWith(" ");
    $(SPACED_ELEMENTS).each((_, element) => {
        $(element).append(" ");
    });

    const meta = {};
    $("meta").each((_, element) => {
        const $element = $(element);
        const key = $element.attr("property") || $element.attr("name");
        const content = $element.attr("content");
        if (key && content) meta[key.toLowerCase()] = content;
    });

    const headings = $("h1, h2, h3, h4, h5, h6")
        .map((_, element) => ({
            level: Number(element.tagName.slice(1)),
            text: normalize($(element).text()),
        }))
        .get()
        .filter((heading) => heading.text.length > 0);

    const links = $("a[href]")
        .map((_, element) => ({
            href: resolveUrl($(element).attr("href"), baseUrl),
            text: normalize($(element).text()),
        }))
        .get();

    const images = $("img")
        .map((_, element) => {
            const $element = $(element);
            const src = $element.attr("src") || $element.attr("data-src");
            return src ? { src: resolveUrl(src, baseUrl), alt: normalize($element.attr("alt")) } : null;
        })
        .get()
        .filter(Boolean);

    const text = normalize($("body").text() || $.root().text());
    // no text but there's a JS bundle means the page renders client side. without this
    // flag headings=0 links=0 text=0 reads like "page has none of these" when really "none
    // of these were ever sent" - that's the difference between a bad selector and an
    // un-scrapable page
    const clientRendered = text.length === 0 && scripts.length > 0;

    const content = {
        title: normalize($("title").first().text()),
        description: meta.description ?? "",
        canonical: resolveUrl($('link[rel="canonical"]').first().attr("href"), baseUrl),
        lang: $("html").attr("lang") ?? null,
        headings,
        links,
        images,
        scripts,
        clientRendered,
        meta,
        openGraph: Object.fromEntries(
            Object.entries(meta).filter(([key]) => key.startsWith("og:")),
        ),
        text,
    };

    return PageContentSchema.parse(content);
}
