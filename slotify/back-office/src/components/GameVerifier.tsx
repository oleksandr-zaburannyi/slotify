import {Button, Divider, Form, Input, message, Tooltip} from "antd";
import React, {useRef, useState} from "react";
import "graphiql/graphiql.css";
import {useAppState} from "../lib/AppProvider";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import {InfoCircleOutlined, PlayCircleOutlined} from "@ant-design/icons";
import SelectAutoComplete from "./SelectAutoComplete";
import {gql} from "graphql-request";
import {PDFExportButton} from "./Buttons";

interface IData {
    summary: {passed: number; failed: number};
    tests: {name: string; assertions: {message: string; passed: boolean}[]; request: {url: string; method: string; body: string; text: string; status: string; headers: any; responseHeaders: string[][]}}[];
}

const GameVerifier = () => {
    const [state] = useAppState();
    const outputElement = useRef<HTMLDivElement>(null);
    const fetcher = useGraphQlFetcher();
    const [isLoading, setIsLoading] = useState(false);

    const [data, setData] = useState<IData>();
    const onFinish = async (params: any) => {
        params.iterations = parseInt(params.iterations, 10);
        if (params.bet) params.bet = parseInt(params.bet, 10);

        const hide = message.loading("Loading...");
        setIsLoading(true);
        try {
            const {gameVerifier} = await fetcher([
                gql`
                    mutation ($provider: String!, $game: String!, $variant: String, $iterations: Int!, $action: String, $bet: Float, $params: String, $criticalFilePath: String!) {
                        gameVerifier(provider: $provider, game: $game, variant: $variant, iterations: $iterations, bet: $bet, action: $action, params: $params, criticalFilePath: $criticalFilePath) {
                            summary {
                                passed
                                failed
                            }
                            tests {
                                name
                                request {
                                    url
                                    method
                                    body
                                    responseHeaders
                                    headers
                                    status
                                    text
                                }
                                assertions {
                                    passed
                                    message
                                }
                            }
                        }
                    }
                `,
                params,
            ]);
            setData(gameVerifier);
        } finally {
            hide();
            setIsLoading(false);
        }
    };

    return (
        <>
            <Form name="basic" layout={state.mobile ? "horizontal" : "inline"} onFinish={onFinish} initialValues={{remember: true, wallet: state.account.wallet}}>
                <Form.Item label="Provider" name="provider" rules={[{required: true, message: "Please enter provider"}]}>
                    <SelectAutoComplete type={"providers"} mode="single" />
                </Form.Item>

                <Form.Item label="Game" name="game" rules={[{required: true, message: "Please enter game"}]}>
                    <SelectAutoComplete type={"games"} mode="single" />
                </Form.Item>

                <Form.Item label="Variant" name="variant">
                    <Input type="text" placeholder="Variant" />
                </Form.Item>

                <Divider style={{fontSize: 14}}>Simulation</Divider>

                <Form.Item label="Iterations" name="iterations" rules={[{required: true, message: "Please enter iterations"}]}>
                    <Input type="number" placeholder="iterations" style={{width: 100}} />
                </Form.Item>

                <Form.Item
                    label={
                        <>
                            Action&nbsp;
                            <Tooltip title={"Leave empty for random action"}>
                                <InfoCircleOutlined />
                            </Tooltip>
                        </>
                    }
                    name="action"
                >
                    <Input type="text" placeholder="Action" />
                </Form.Item>

                <Form.Item
                    label={
                        <>
                            Bet&nbsp;
                            <Tooltip title={"Leave empty for random bet"}>
                                <InfoCircleOutlined />
                            </Tooltip>
                        </>
                    }
                    name="bet"
                >
                    <Input type="number" placeholder="Bet" style={{width: 100}} />
                </Form.Item>

                <Form.Item
                    label={
                        <>
                            Initial Params&nbsp;
                            <Tooltip title={"Required only for games with params on initial bet"}>
                                <InfoCircleOutlined />
                            </Tooltip>
                        </>
                    }
                    name="params"
                >
                    <Input type="text" placeholder='{"multiplier": 2}' />
                </Form.Item>

                <Divider style={{fontSize: 14}}>Compliance</Divider>

                <Form.Item label="Critical file path" name="criticalFilePath" initialValue="package.json" rules={[{required: true, message: "Please enter example critical file path"}]}>
                    <Input type="text" />
                </Form.Item>

                <Form.Item style={{width: "100%", marginTop: 20}}>
                    <Button type="primary" htmlType="submit" disabled={isLoading} icon={<PlayCircleOutlined />}>
                        Run
                    </Button>
                </Form.Item>

                {data && (
                    <Form.Item style={{marginTop: 20, width: "100%"}}>
                        <PDFExportButton element={outputElement!} />
                    </Form.Item>
                )}
            </Form>

            {data && (
                <div ref={outputElement}>
                    <hr />
                    <span style={{color: "darkgreen"}}>Passed: {data.summary.passed}</span>
                    <br />
                    <span style={{color: "#d20f0f"}}>Failed: {data.summary.failed}</span>
                    <hr />
                    <div>
                        {data.tests?.map((test, i) => {
                            return (
                                <div key={"test" + i}>
                                    <h3>{test.name}</h3>
                                    {test.assertions.map((assertion, i) => {
                                        return (
                                            <li key={"assertion" + i} style={{color: assertion.passed ? "darkgreen" : "#d20f0f"}}>
                                                <div
                                                    style={{display: "inline"}}
                                                    dangerouslySetInnerHTML={{
                                                        __html: assertion.message.replace(/'(.*?)'/g, "<span class='code'>$1</span>"),
                                                    }}
                                                />
                                            </li>
                                        );
                                    })}
                                    {test.request && (
                                        <div
                                            style={{
                                                backgroundColor: "#151515",
                                                boxSizing: "border-box",
                                                margin: "15px",
                                                padding: "20px",
                                                borderRadius: "10px",
                                                fontFamily: "monospace",
                                            }}
                                        >
                                            <p style={{color: "#9CD9F0", margin: 0, wordBreak: "break-all"}}>
                                                $ curl -i \<br />
                                                -X {test.request.method} \<br />
                                                {test.request.body ? "-d '" + test.request.body + "' " : ""}
                                                {test.request.body && (
                                                    <>
                                                        {"\\"} <br />
                                                    </>
                                                )}
                                                {/*${Object.keys(requests[name].headers || {}).map(header => "-H '" + header + ":" + requests[name].headers[header] + "'").join(" \\<br/>" + "\n            ")} \<br/>*/}
                                                {Object.keys(test.request.headers || {}).map(header => (
                                                    <>
                                                        {"-H '" + header + ":" + test.request.headers[header] + "'"} \<br />
                                                    </>
                                                ))}
                                                {test.request.url}
                                                <br />
                                                <br />
                                            </p>
                                            <div style={{color: test.request.status ? "white" : "#d20f0f"}}>
                                                HTTP/1.1 {test.request.status}
                                                <br />
                                                {(test.request.responseHeaders || []).map((header: any) => (
                                                    <>
                                                        <b>{header[0].charAt(0).toUpperCase() + header[0].slice(1)}</b>: {header[1]}
                                                        <br />
                                                    </>
                                                ))}
                                                <br />
                                                <pre style={{whiteSpace: "pre-wrap"}}>{test.request.text}</pre>
                                                {/*{test.request.text ? test.request.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : ""}*/}
                                            </div>
                                        </div>
                                    )}
                                    <hr />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
};
export default GameVerifier;
