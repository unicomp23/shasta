import {logger} from 'node-media-utils/libs';
import {prettySpaces} from "../constants";

export const slog = {
    info: (message: string, o?: any) => {
        if (o)
            message = message + ": " + JSON.stringify(o, null, prettySpaces);
        logger.info(message);
    },

    warn: (message: string, o?: any) => {
        if (o)
            message = message + ": " + JSON.stringify(o, null, prettySpaces);
        logger.warn(message);
    },

    error: (message: string, o?: any) => {
        if (o)
            message = message + ": " + JSON.stringify(o, null, prettySpaces);
        logger.error(message);
    }
};
