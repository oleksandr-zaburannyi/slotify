import Exception from "@slotify/shared/lib/Exception";
import {StatusCode} from "@slotify/shared/lib/StatusCode";

export class ValidationException extends Exception {
    constructor(message: string, {data}: {data?: any} = {}) {
        super(message, {code: "VALIDATION_FAILED", status: StatusCode.BAD_REQUEST, data});
    }
}
