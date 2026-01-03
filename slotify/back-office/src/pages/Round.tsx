import {Button, Card, message, Modal, Space, Table, Tag} from "antd";
import {gql} from "graphql-request";
import React, {useMemo, useState} from "react";
import JsonView from "react18-json-view";
import useSWR from "swr";
import useGraphQlFetcher from "../lib/useGraphQlFetcher";
import StatusTag from "../components/StatusTag";
import {Link, useParams} from "react-router-dom";
import {useAppState} from "../lib/AppProvider";
import IpAddress from "../components/IpAddress";
import {MinusCircleTwoTone, PlayCircleOutlined, PlusCircleTwoTone} from "@ant-design/icons";
import CryptoJS from "crypto-js";
import Currency from "../components/Currency";
import {campaignTypes} from "./promo/campaignTypes";

function closeTransactionAction(type: string, status: string): string | void {
    if (type === "withdraw" && status === "cancel") return "Mark as cancelled";
    if (type === "withdraw" && status === "started") return "Mark as cancel";
    if (type === "deposit" && status === "failed") return "Mark as finished";
    if (type === "deposit" && status === "rejected") return "Mark as failed";
    if (type === "deposit" && status === "started") return "Mark as failed";
}

function random(serverSeed: string, clientSeed: string, nonce: number, cursor: number) {
    // Generate hash
    const hashIndex = Math.floor(cursor / 8);
    const hmac = CryptoJS.HmacSHA256(`${clientSeed}:${nonce}:${hashIndex}`, serverSeed);

    // Pick correct byte and from signed to unsigned integer
    return hmac.words[cursor % 8] >>> 0;
}

const Rounds = () => {
    const [state] = useAppState();
    const [replayActive, setReplayActive] = useState(false);
    const {id} = useParams<{id: string}>();
    const fetcher = useGraphQlFetcher();
    const variablesRound = useMemo(() => ({roundId: id}), [id]);

    const queryRound = gql`
        query ($roundId: JSON!) {
            wagers(filter: [{field: "roundId", type: EQUAL, value: $roundId}], sort: {field: "createdAt", order: ASC}, limit: 1000) {
                items {
                    createdAt
                    bet
                    win
                    action
                    data
                    state
                    params
                    promo
                    next
                    auto
                }
            }
            rounds(filter: [{field: "roundId", type: EQUAL, value: $roundId}], sort: {field: "createdAt", order: ASC}) {
                items {
                    roundId
                    createdAt
                    playerId
                    status
                    game
                    variant
                }
            }
        }
    `;
    const rgsData = useSWR(state?.services.includes("rgs") && state?.account?.permissions?.includes("gameplay") ? [queryRound, variablesRound] : null, fetcher, {revalidateOnFocus: false, shouldRetryOnError: false});

    const queryTransaction = gql`
        query ($roundId: JSON!) {
            transactions(filter: [{field: "roundId", type: EQUAL, value: $roundId}], sort: {field: "createdAt", order: ASC}, limit: 1000) {
                items {
                    roundId
                    transactionId
                    game
                    variant
                    rgs
                    rgsRoundId
                    rgsTransactionId
                    provider
                    playerId
                    nativeId
                    channel
                    wallet
                    operator
                    brand
                    jurisdiction
                    replayUrl
                    roundFinished
                    transactionId
                    createdAt
                    finishedAt
                    cancelledAt
                    winRatio
                    status
                    failReason
                    type
                    amount
                    jackpotAmount
                    category
                    name
                    campaignId
                    campaignType
                    currency
                    ip
                    verificationScore
                    verificationAction
                    verificationDetails
                    regulatory
                    auto
                }
            }
        }
    `;
    const transactionData = useSWR([queryTransaction, variablesRound], fetcher, {revalidateOnFocus: false, shouldRetryOnError: false});

    const summary = transactionData.data?.transactions.items[0] || {};
    const transactions = transactionData.data?.transactions.items || [];
    const {verificationScore, verificationAction, verificationDetails} = transactionData.data?.transactions.items[0] || {};

    const wagers = rgsData?.data?.wagers.items || [];
    const round = rgsData?.data?.rounds.items[0] || [];

    const regulatory = transactions.length > 0 && transactions[transactions.length - 1].regulatory;

    const queryDrawId = gql`
        query ($roundId: JSON!) {
            commands(filter: [{field: "roundId", type: EQUAL, value: $roundId}], sort: {field: "createdAt", order: ASC}, limit: 1) {
                items {
                    drawId
                }
            }
        }
    `;
    const drawIdData = useSWR(state.services.includes("rgs") && state.account.permissions?.includes("gameplay") && [queryDrawId, variablesRound], fetcher, {revalidateOnFocus: false, shouldRetryOnError: false});
    const variablesDraw = {drawId: drawIdData?.data?.commands?.items?.length > 0 ? drawIdData.data.commands.items[0].drawId : null};

    const queryDraw = gql`
        query ($drawId: JSON!) {
            draws(filter: [{field: "drawId", type: EQUAL, value: $drawId}], sort: {field: "createdAt", order: ASC}, limit: 100000) {
                items {
                    id
                    drawId
                    createdAt
                    roomId
                    finished
                    nextTickTime
                    state
                }
            }
            commands(filter: [{field: "drawId", type: EQUAL, value: $drawId}], sort: {field: "createdAt", order: ASC}, limit: 100000) {
                items {
                    commandId
                    playerId
                    tickId
                    action
                    bet
                    currency
                    params
                    time
                    withdrawalStatus
                }
            }
            drawWins(filter: [{field: "drawId", type: EQUAL, value: $drawId}], sort: {field: "createdAt", order: ASC}, limit: 100000) {
                items {
                    playerId
                    tickId
                    amount
                    createdAt
                    drawId
                    drawWinId
                    status
                }
            }
        }
    `;

    const drawsData = useSWR(state.services.includes("rgs") && state.account.permissions?.includes("gameplay") && variablesDraw.drawId ? [queryDraw, variablesDraw] : null, fetcher, {revalidateOnFocus: false, shouldRetryOnError: false});

    const queryProvablyFair = gql`
        query ($roundId: JSON!) {
            roundRngStates(filter: [{field: "roundId", type: EQUAL, value: $roundId}]) {
                items {
                    clientSeed
                    serverSeedHash
                    nextServerSeedHash
                    serverSeedStatus
                    serverSeed
                    nonce
                    cursor
                    status
                }
            }
        }
    `;

    const provablyFairData = useSWR(state.services.includes("rng") && state.account.permissions?.includes("gameplay") ? [queryProvablyFair, {roundId: id}] : null, fetcher, {revalidateOnFocus: false, shouldRetryOnError: false});

    const JsonLink: React.FunctionComponent<any> = ({data}) => {
        return (
            <>
                {data && (
                    <button style={{border: "none", cursor: "pointer"}} onClick={() => setJsonModalVisible(data)}>
                        JSON&raquo;
                    </button>
                )}
            </>
        );
    };

    const [jsonModalVisible, setJsonModalVisible] = useState<any>(null);

    const summaryColumns = [
        {dataIndex: "label", key: "label", render: (value: string) => <b>{value}</b>, width: 115},
        {dataIndex: "value", key: "value"},
    ];
    const transactionColumns = [
        {title: "Created at", dataIndex: "createdAt", render: (createdAt: string) => new Date(parseInt(createdAt)).toLocaleString(), ellipsis: {}},
        {title: "Finished at", dataIndex: "finishedAt", render: (finishedAt: string) => (finishedAt ? new Date(parseInt(finishedAt)).toLocaleString() : ""), ellipsis: {}},
        {title: "Cancelled at", dataIndex: "cancelledAt", render: (cancelledAt: string) => (cancelledAt ? new Date(parseInt(cancelledAt)).toLocaleString() : ""), ellipsis: {}},
        {title: "Transaction Id", dataIndex: "transactionId", ellipsis: {}},
        {title: "Type", dataIndex: "type", render: (status: string) => <StatusTag status={status} />, ellipsis: {}},
        {title: "Amount", dataIndex: "amount", render: (value: number) => <Currency currency={summary.currency} amount={value} />},
        {title: "Jackpot amount", dataIndex: "jackpotAmount", render: (value: number) => <Currency currency={summary.currency} amount={value} />, ellipsis: {}},
        {title: "Currency", dataIndex: "currency", ellipsis: {}},
        {title: "Category", dataIndex: "category", ellipsis: {}},
        {title: "Name", dataIndex: "name", ellipsis: {}},
        {
            title: "Campaign Type",
            dataIndex: "campaignType",
            ellipsis: {},
            render: (type: string) => (campaignTypes[type] ? campaignTypes[type].name : type),
        },
        {title: "Campaign Id", dataIndex: "campaignId", ellipsis: {}, render: (campaignId: string) => <Link to={`/campaigns/${campaignId}`}>{campaignId}</Link>},
        {title: "Status", dataIndex: "status", key: "status", render: (_: any, {status, failReason}: any) => <StatusTag status={status} comment={failReason} />, ellipsis: {}},
        {title: "Round finished", dataIndex: "roundFinished", key: "roundFinished", render: (finished: string) => <Tag color={finished ? "green" : "lightgrey"}>{finished ? "true" : "false"}</Tag>, ellipsis: {}},
        {title: "RGS Transaction Id", dataIndex: "rgsTransactionId", ellipsis: {}},
        {title: "Auto", dataIndex: "auto", key: "auto", render: (auto: boolean) => <Tag color={auto ? "red" : "green"}>{auto ? "true" : "false"}</Tag>, ellipsis: {}},
        {title: "Channel", dataIndex: "channel", sorter: true},
        {title: "IP", dataIndex: "ip", sorter: true, render: (ip?: string) => <IpAddress ip={ip} />},
        {
            title: "Actions",
            render: ({transactionId, status, type}: {transactionId: string; status: string; type: string}) =>
                state?.account?.permissions?.includes("closeTransaction") &&
                closeTransactionAction(type, status) && (
                    <Button
                        onClick={() =>
                            Modal.confirm({
                                title: "Transaction status change",
                                content: "Are you sure you want to change the status of this transaction?",
                                onOk: () => {
                                    return new Promise((resolve, reject) => {
                                        fetcher([
                                            gql`
                                                mutation ($id: ID!) {
                                                    closeTransaction(id: $id)
                                                }
                                            `,
                                            {id: transactionId},
                                        ])
                                            .then(() => {
                                                message.success("Transaction closed successfully");
                                                transactionData.mutate();
                                                resolve(false);
                                            })
                                            .catch(() => {
                                                reject();
                                            });
                                    });
                                },
                            })
                        }
                    >
                        {closeTransactionAction(type, status)!}
                    </Button>
                ),
        },
    ];

    const wagerColumns = [
        {
            title: "Date",
            dataIndex: "createdAt",
            key: "createdAt",
            render: (createdAt: string) => new Date(createdAt).toLocaleString(),
        },
        {title: "Bet", dataIndex: "bet", key: "bet", render: (value: number) => <Currency currency={summary.currency} amount={value} />},
        {title: "Win", dataIndex: "win", key: "win", render: (value: number) => <Currency currency={summary.currency} amount={value} />},
        {title: "Action", dataIndex: "action", key: "action"},
        {title: "Next", dataIndex: "next", key: "next", render: (next: string[]) => (next ? next.join(", ") : "")},
        {
            title: "Params",
            dataIndex: "params",
            key: "params",
            render: (params: any = {}) => <JsonLink data={params} />,
        },
        {
            title: "State",
            dataIndex: "state",
            key: "state",
            render: (state: any) => <JsonLink data={state} />,
        },
        {
            title: "Data",
            dataIndex: "data",
            key: "data",
            render: (data: any) => <JsonLink data={data} />,
        },
        {
            title: "Promo",
            dataIndex: "promo",
            key: "promo",
            render: (promo: any) => <JsonLink data={promo} />,
        },
        {
            title: "Auto",
            dataIndex: "auto",
            key: "auto",
            render: (auto: boolean) => (
                <Tag key={auto.toString()} color={auto ? "red" : "green"}>
                    {auto ? "true" : "false"}
                </Tag>
            ),
        },
    ];

    const commandsColumns = [
        {title: "Time", dataIndex: "time", key: "time", render: (time: string) => new Date(time).toLocaleString() + "." + new Date(time).getMilliseconds().toString().padStart(3, "0")},
        {title: "Tick Id", dataIndex: "tickId", key: "tickId", render: (value: any) => value, ellipsis: {}},
        {title: "Player Id", dataIndex: "playerId", key: "playerId", render: (value: any) => value},
        {title: "Command Id", dataIndex: "commandId", key: "commandId", render: (value: any) => value},
        {title: "Action", dataIndex: "action", key: "action", render: (value: any) => value},
        {title: "Params", dataIndex: "params", key: "params", render: (wins: any) => <JsonLink data={wins} />},
        {title: "Bet", dataIndex: "bet", key: "bet", render: (value: number) => <Currency currency={summary.currency} amount={value} />},
        {title: "Currency", dataIndex: "currency", key: "currency", render: (value: any) => value},
        {title: "Withdrawal status", dataIndex: "withdrawalStatus", key: "withdrawalStatus", render: (value?: string) => value && <StatusTag status={value} />},
    ];

    const drawWinsColumns = [
        {title: "Created at", dataIndex: "createdAt", render: (createdAt: string) => new Date(parseInt(createdAt)).toLocaleString(), ellipsis: {}},
        {title: "Player Id", dataIndex: "playerId", key: "playerId", render: (value: any) => value},
        {title: "Draw Win Id", dataIndex: "drawWinId", key: "drawWinId", render: (value: any) => value},
        {
            title: "Status",
            key: "status",
            render: ({status, drawWinId}: any) =>
                status && (
                    <>
                        <StatusTag status={status} />

                        {state?.account?.permissions?.includes("closeTransaction") && ["unpaid", "finishing", "started"].includes(status) && (
                            <Button
                                onClick={() =>
                                    Modal.confirm({
                                        title: "DrawWin status change",
                                        content: "Are you sure you want to pay this Draw Win?",
                                        onOk: () => {
                                            return new Promise((resolve, reject) => {
                                                fetcher([
                                                    gql`
                                                        mutation ($drawWinId: ID!) {
                                                            payDrawWin(drawWinId: $drawWinId)
                                                        }
                                                    `,
                                                    {drawWinId},
                                                ])
                                                    .then(() => {
                                                        message.success("DrawWin closed successfully");
                                                        drawsData.mutate();
                                                        resolve(false);
                                                    })
                                                    .catch(() => {
                                                        reject();
                                                    });
                                            });
                                        },
                                    })
                                }
                            >
                                Pay Draw Win
                            </Button>
                        )}
                    </>
                ),
        },
        {title: "Amount", dataIndex: "amount", key: "amount", render: (value: number) => <Currency currency={summary.currency} amount={value} />},
    ];

    const summaryData = [
        {label: "Round Id", value: summary?.roundId},
        {label: "Player Id", value: summary?.playerId},
        {label: "Native Id", value: summary?.nativeId},
        {label: "RGS", value: summary?.rgs},
        {label: "RGS Round Id", value: summary?.rgsRoundId},
        {label: "Provider", value: summary?.provider},
        {label: "Game", value: summary?.game},
        {label: "Variant", value: summary?.variant},
        {label: "Currency", value: summary?.currency},
        {label: "Wallet", value: summary?.wallet},
        {label: "Operator", value: summary?.operator},
        {label: "Brand", value: summary?.brand},
        {label: "Jurisdiction", value: summary?.jurisdiction},
        {label: "Win ratio", value: transactionData.data?.transactions?.items.length >= 2 && transactionData.data?.transactions?.items[1]?.winRatio !== null ? `x${transactionData.data?.transactions.items[1]?.winRatio?.toFixed(2)}` : ""},
        {
            label: "Replay URL",
            value: transactionData.data && (
                <a href={summary && summary.replayUrl} target="_blank" rel="noopener noreferrer" style={{wordBreak: "break-all"}}>
                    {summary && summary.replayUrl}
                </a>
            ),
        },
    ];

    const roundSummaryData = [
        {label: "CreatedAt", value: new Date(parseInt(round?.createdAt)).toLocaleString()},
        {
            label: "Status",
            value: (
                <>
                    <StatusTag status={round?.status} />
                    {state?.account?.permissions?.includes("closeTransaction") && ["unpaid", "finishing", "started"].includes(round?.status) && (
                        <Button
                            onClick={() =>
                                Modal.confirm({
                                    title: "Round status change",
                                    content: "Are you sure you want to close this round?",
                                    onOk: () => {
                                        return new Promise((resolve, reject) => {
                                            fetcher([
                                                gql`
                                                    mutation ($roundId: ID!) {
                                                        autoCompleteRound(roundId: $roundId)
                                                    }
                                                `,
                                                {roundId: id},
                                            ])
                                                .then(() => {
                                                    message.success("Round closed successfully");
                                                    transactionData.mutate();
                                                    rgsData.mutate();
                                                    resolve(false);
                                                })
                                                .catch(() => {
                                                    reject();
                                                });
                                        });
                                    },
                                })
                            }
                        >
                            Close round
                        </Button>
                    )}
                </>
            ),
        },
    ];

    const draw = (drawsData?.data?.draws?.items || [])[0];
    // const drawWin = (drawsData?.data?.drawWins?.items || []).find((drawWin: any) => drawWin.drawId === variablesDraw.drawId);
    const drawSummaryData = [
        {label: "Room Id", value: draw?.roomId},
        {label: "Draw Id", value: draw?.drawId},
        {label: "State", value: draw?.state && <JsonLink data={draw.state} />},
        {label: "Next tick", value: draw?.nextTickTime && new Date(draw.nextTickTime).toLocaleTimeString() + "." + new Date(draw.nextTickTime).getMilliseconds().toString().padStart(3, "0")},
        // {label: "Draw Win Status", value: drawWin && <StatusTag status={drawWin?.status} />},
        {
            label: "Finished",
            value: (
                <Tag key={draw?.finished?.toString()} color={draw?.finished ? "green" : "lightgrey"}>
                    {draw?.finished ? "true" : "false"}
                </Tag>
            ),
        },
    ];
    const provablyFair = (provablyFairData?.data?.roundRngStates?.items || [])[0];
    const provablyFairSummaryData = [
        {label: "Client seed", value: <span style={{fontFamily: "monospace"}}>{provablyFair?.clientSeed}</span>},
        {label: "Server seed hash", value: <span style={{fontFamily: "monospace"}}>{provablyFair?.serverSeedHash}</span>},
        {label: "Next server seed hash", value: <span style={{fontFamily: "monospace"}}>{provablyFair?.nextServerSeedHash}</span>},
        {
            label: "Server seed status",
            value: (
                <Tag key={provablyFair?.serverSeedStatus?.toString()} color={provablyFair?.serverSeedStatus ? "green" : "lightgrey"}>
                    {provablyFair?.serverSeedStatus}
                </Tag>
            ),
        },
        {label: "Server seed", value: <span style={{fontFamily: "monospace"}}>{provablyFair?.serverSeed}</span>},
        {label: "Nonce", value: <span style={{fontFamily: "monospace"}}>{provablyFair?.nonce}</span>},
        {label: "Cursor", value: <span style={{fontFamily: "monospace"}}>{provablyFair?.cursor}</span>},
        {
            label: "Round rng status",
            value: (
                <Tag key={provablyFair?.status?.toString()} color={provablyFair?.status ? "green" : "lightgrey"}>
                    {provablyFair?.status}
                </Tag>
            ),
        },
    ];

    const provablyFairNumbersColumns = [
        {key: "cursor", dataKey: "cursor", render: ({cursor}: any) => cursor},
        {
            key: "hmac",
            render: ({serverSeed, clientSeed, nonce, cursor}: any) => (
                <span style={{fontFamily: "monospace"}}>
                    HMAC_SHA256({serverSeed},{clientSeed}:{nonce}:{Math.floor(cursor / 8)})
                </span>
            ),
        },
        {key: "result", render: ({serverSeed, clientSeed, nonce, cursor}: any) => <span style={{fontFamily: "monospace"}}>{random(serverSeed, clientSeed, nonce, cursor)}</span>},
    ];

    const provablyFairNumbers = provablyFair?.serverSeed ? new Array(provablyFair?.cursor).fill(undefined).map((_, i) => ({...provablyFair, cursor: i})) : [];

    const wagerPlayersObj: any = {};
    if (summary && summary.wagers) {
        summary.wagers.forEach((wager: any) => {
            wagerPlayersObj[wager.playerId] = true;
        });
    }

    const transactionPlayersObj: any = {};
    if (summary && summary.transactions) {
        summary.transactions.forEach((wager: any) => {
            transactionPlayersObj[wager.playerId] = true;
        });
    }

    const verificationColumns = [
        {
            key: "light",
            render: ({points}: {points: number}) => (
                <>
                    {points > 0 && <PlusCircleTwoTone twoToneColor="red" />}
                    {/*{color === "orange" && <ExclamationCircleTwoTone twoToneColor="orange"/>}*/}
                    {points <= 0 && <MinusCircleTwoTone twoToneColor="#52c41a" />}
                </>
            ),
            width: 20,
        },
        {title: "Points", dataIndex: "points", key: "points", render: (points: number) => <div style={{width: "100%", textAlign: "right", fontFamily: "monospace"}}>{points >= 0 ? "+" + points : points}</div>, width: 50},
        {title: "Weight", dataIndex: "weight", key: "weight", render: (weight: number) => <div style={{width: "100%", textAlign: "right", fontFamily: "monospace"}}>{weight >= 0 ? "+" + weight : weight}</div>, width: 50},
        {title: "Description", dataIndex: "description", key: "description", render: (text: string) => <i>{text}</i>},
    ];

    return (
        <>
            <Card title={"Summary"}>
                <Table dataSource={summaryData} size={"small"} rowKey={"label"} columns={summaryColumns} showHeader={false} pagination={false} />
            </Card>
            &nbsp;
            {verificationDetails && (
                <>
                    <Card title={"Verification"}>
                        <Table
                            dataSource={verificationDetails.checks}
                            size={"small"}
                            rowKey={"description"}
                            columns={verificationColumns}
                            showHeader={true}
                            pagination={false}
                            summary={() => (
                                <Table.Summary fixed>
                                    <Table.Summary.Row style={{backgroundColor: "rgba(0, 0, 0, 0.05)"}}>
                                        <Table.Summary.Cell index={0} colSpan={4}>
                                            <StatusTag status={verificationAction} />
                                            <span style={{fontFamily: "monospace"}}>
                                                <b>{verificationScore} points</b>
                                            </span>
                                        </Table.Summary.Cell>
                                    </Table.Summary.Row>
                                </Table.Summary>
                            )}
                        />
                    </Card>
                    &nbsp;
                </>
            )}
            <Card title={"Transactions"}>
                <Table columns={transactionColumns as any} dataSource={transactions} rowKey={"transactionId"} pagination={false} size={"small"} scroll={{x: true}} style={{textAlign: "center"}} />
            </Card>
            &nbsp;
            {drawsData?.data?.draws?.items?.length > 0 && (
                <>
                    <Card title={"Draw"}>
                        <Table dataSource={drawSummaryData} size={"small"} rowKey={"label"} columns={summaryColumns} showHeader={false} pagination={false} />
                    </Card>
                    &nbsp;
                    <Card title={"Commands"}>
                        <Table columns={commandsColumns} dataSource={drawsData.data.commands.items} rowKey={"time"} pagination={false} size={"small"} scroll={{x: true, y: 500}} style={{textAlign: "center"}} />
                    </Card>
                    &nbsp;
                    <Card title={"Draw Wins"}>
                        <Table columns={drawWinsColumns} dataSource={drawsData.data.drawWins.items} rowKey={"createdAt"} pagination={false} size={"small"} scroll={{x: true, y: 500}} style={{textAlign: "center"}} />
                    </Card>
                    &nbsp;
                </>
            )}
            {rgsData?.data?.rounds?.items?.length > 0 && (
                <>
                    <Card title={"Round"}>
                        <Table dataSource={roundSummaryData} size={"small"} rowKey={"label"} columns={summaryColumns} showHeader={false} pagination={false} />
                    </Card>
                    &nbsp;
                    <Card title={"Wagers"}>
                        <Table columns={wagerColumns as any} dataSource={wagers} rowKey={"createdAt"} pagination={false} size={"small"} scroll={{x: true}} style={{textAlign: "center"}} />
                    </Card>
                    &nbsp;
                </>
            )}
            {provablyFairData?.data?.roundRngStates?.items?.length > 0 && (
                <>
                    <Card title={"Provably fair"}>
                        <Table dataSource={provablyFairSummaryData} size={"small"} rowKey={"label"} columns={summaryColumns} showHeader={false} pagination={false} />
                        &nbsp;
                        <Table dataSource={provablyFairNumbers} size={"small"} rowKey={"cursor"} columns={provablyFairNumbersColumns} showHeader={false} pagination={false} />
                    </Card>
                    &nbsp;
                </>
            )}
            <Card title={"Replay"}>
                <div className="iframeWrapper" style={{position: "relative", paddingBottom: "56.25%"}}>
                    {!replayActive && (
                        <Space direction="horizontal" style={{width: "100%", height: "100%", position: "absolute", justifyContent: "center", backgroundColor: "rgba(0, 0, 0, 0.05)"}}>
                            <Button style={{padding: 20, height: 80, width: 200}} size={"large"} onClick={() => setReplayActive(true)}>
                                <PlayCircleOutlined />
                                LOAD
                            </Button>
                        </Space>
                    )}
                    {replayActive && <iframe title={"iframe"} width="100%" height="100%" style={{width: "100%", height: "100%", position: "absolute", backgroundColor: "#fafafa", border: 0}} src={summary && summary.replayUrl}></iframe>}
                </div>
            </Card>
            &nbsp;
            {regulatory && (
                <Card title={"Regulatory"} style={{wordBreak: "break-all"}}>
                    <JsonView collapsed={false} enableClipboard={false} src={regulatory} />
                </Card>
            )}
            <Modal closable={true} open={jsonModalVisible !== null} footer={null} transitionName={""} onCancel={() => setJsonModalVisible(null)} width={"50%"}>
                {jsonModalVisible && (
                    <div style={{overflow: "auto", width: "100%", maxHeight: "calc(100vh - 225px)"}}>
                        <JsonView collapsed={1} enableClipboard={true} src={jsonModalVisible} />
                    </div>
                )}
            </Modal>
        </>
    );
};
export default Rounds;
