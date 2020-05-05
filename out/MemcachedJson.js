"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//JSON-编码值
const MemcachedStr_1 = require("./MemcachedStr");
class MemcachedJson extends MemcachedStr_1.MemcachedStr {
    encode(d) {
        return { buf: Buffer.from(JSON.stringify(d)), flag: 0 };
    }
    decode(v) {
        if (v == null)
            return null;
        var str = v.val.toString();
        var d;
        try {
            d = JSON.parse(str);
        }
        catch (e) {
            if (v.flag == 1) {
                d = this.sock["parseNumber"](str);
            }
            else if (v.flag == 2) {
                d = Number(str);
            }
            else if (v.flag == 3) {
                d = Number(str) ? true : false;
            }
            else {
                d = str;
            }
        }
        if (v.hasOwnProperty("cas")) {
            return { val: d, cas: v.cas };
        }
        return d;
    }
}
exports.MemcachedJson = MemcachedJson;
