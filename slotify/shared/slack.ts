import {NodeHtmlMarkdown} from "node-html-markdown";
import fetch from "./fetch";
import Exception from "./Exception";

const webhook = process.env.SLACK_WEBHOOK;
const maxTextCharacters = 3000;

function fixLinksForSlack(markdown: string): string {
    return markdown.replace(/\[([^\]]+)]\(([^)]+)\)/g, "<$2|$1>");
}

export async function sendSlackMessage(subject: string, htmlContent: string, priority: boolean = false) {
    if (!webhook) return;

    const markdown = fixLinksForSlack(
        NodeHtmlMarkdown.translate(htmlContent, {
            strongDelimiter: "*",
            globalEscape: [/(.*)/, "$1"],
        }).slice(0, maxTextCharacters),
    );
    const data = {
        blocks: [
            {type: "header", text: {type: "plain_text", text: `${priority ? ":bangbang: " : ""} ${subject}`}},
            {type: "context", elements: [{type: "mrkdwn", text: `Env: <${process.env.URL}|${process.env.ENV}>`}]},
            {type: "section", text: {type: "mrkdwn", text: markdown}},
        ],
    };
    const res = await fetch(webhook, {
        method: "POST",
        headers: {"Content-type": "application/json"},
        body: JSON.stringify(data),
    });
    const text = await res.text();
    if (text !== "ok") {
        throw new Exception("Couldn't send Slack message", {data: {text}});
    }
}
