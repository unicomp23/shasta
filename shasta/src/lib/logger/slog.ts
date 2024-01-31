import {prettySpaces} from "../constants";

export const slog = {
    info: (message: string, o?: any) => {
        if (o)
            message = message + ": " + JSON.stringify(o, null, prettySpaces);
        console.info(message);
    },

    warn: (message: string, o?: any) => {
        if (o)
            message = message + ": " + JSON.stringify(o, null, prettySpaces);
        console.warn(message);
    },

    error: (message: string, o?: any) => {
        if (o)
            message = message + ": " + JSON.stringify(o, null, prettySpaces);
        console.error(message);
    }
};
