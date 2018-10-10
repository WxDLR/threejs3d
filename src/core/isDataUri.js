import {Check} from "./Check";

var dataUriRegex = /^data:/i;

/**
 * Determines if the specified uri is a data uri.
 *
 * @exports isDataUri
 *
 * @param {String} uri The uri to test.
 * @returns {Boolean} true when the uri is a data uri; otherwise, false.
 *
 * @private
 */
export function isDataUri(uri) {
    //>>includeStart('debug', pragmas.debug);
    Check.typeOf.string('uri', uri);
    //>>includeEnd('debug');

    return dataUriRegex.test(uri);
}
