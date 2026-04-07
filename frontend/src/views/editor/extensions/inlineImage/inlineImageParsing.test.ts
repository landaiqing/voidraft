import {describe, expect, it} from "vitest";
import {createInlineImageTag, parseInlineImagesFromString} from "./inlineImageParsing";

describe("inlineImage image parsing", () => {
    it("parses image tags with required and optional params", () => {
        const tag = "<∞img;id=abc;asset=sha256_asset;file=/media/2026/04/test.png;w=1200;h=630;dw=300;dh=200∞>";
        const content = `before ${tag} after`;

        const images = parseInlineImagesFromString(content);

        expect(images).toHaveLength(1);
        expect(images[0]).toEqual({
            from: content.indexOf(tag),
            to: content.indexOf(tag) + tag.length,
            id: "abc",
            assetRef: "sha256_asset",
            file: "/media/2026/04/test.png",
            width: 1200,
            height: 630,
            displayWidth: 300,
            displayHeight: 200,
        });
    });

    it("ignores tags missing required params", () => {
        const tag1 = "<∞img;id=1;file=/media/a.png;w=10;h=20∞>";
        const invalid = "<∞img;id=2;file=/media/b.png;w=10∞>";
        const tag2 = "<∞img;id=3;file=/media/c.png;w=30;h=40;dw=15∞>";
        const content = `${tag1} middle ${invalid} tail ${tag2}`;

        const images = parseInlineImagesFromString(content);

        expect(images).toHaveLength(2);
        expect(images[0].id).toBe("1");
        expect(images[1].id).toBe("3");
        expect(images[1].displayWidth).toBe(15);
        expect(images[1].displayHeight).toBeUndefined();
    });

    it("does not leak regex state between calls", () => {
        const tag = "<∞img;id=1;file=/media/a.png;w=10;h=20∞>";
        const first = parseInlineImagesFromString(tag);
        const second = parseInlineImagesFromString(`prefix ${tag}`);

        expect(first).toHaveLength(1);
        expect(second).toHaveLength(1);
        expect(second[0].from).toBe("prefix ".length);
    });
});

describe("inlineImage image tag creation", () => {
    it("creates tag with display dimensions", () => {
        expect(createInlineImageTag({
            id: "1",
            assetRef: "asset-id",
            file: "/media/2026/04/test.png",
            width: 100,
            height: 200,
            displayWidth: 50,
            displayHeight: 60,
        })).toBe("<∞img;id=1;asset=asset-id;file=/media/2026/04/test.png;w=100;h=200;dw=50;dh=60∞>");
    });

    it("omits display dimensions when missing", () => {
        expect(createInlineImageTag({
            id: "1",
            file: "/media/2026/04/test.png",
            width: 100,
            height: 200,
        })).toBe("<∞img;id=1;file=/media/2026/04/test.png;w=100;h=200∞>");
    });
});
