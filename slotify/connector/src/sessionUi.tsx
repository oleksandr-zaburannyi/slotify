import {Connector} from "./Connector";

export function sessionUi(connector: Connector) {
    let sessionData: any;

    connector.emitter.on("authenticated", async data => {
        sessionData = data.sessionData;

        updateSessionHeader(connector, sessionData);
    });

    connector.emitter.on("replayShown", async replay => {
        const replaySessionData = replay.sessionData;

        updateSessionHeader(connector, replaySessionData);
    });

    connector.emitter.on("replayHidden", async () => {
        updateSessionHeader(connector, sessionData);
    });
}

function updateSessionHeader(connector: Connector, sessionData: any) {
    if (sessionData?.italy && (sessionData.italy.sessionId || sessionData.italy.ticketId)) {
        connector.ui().setSessionHeader(
            <>
                {sessionData.italy.sessionId} / {sessionData.italy.ticketId}
            </>,
        );
    }
}
