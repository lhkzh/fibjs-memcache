"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MemcachedStr_1 = require("./MemcachedStr");
//msgpack-编码值
class MemcachedMsgpack extends MemcachedStr_1.MemcachedStr {
    encode(d) {
        return { buf: require("msgpack").encode(d), flag: 21 };
    }
    decode(v) {
        if (v == null)
            return null;
        var d;
        try {
            d = require("msgpack").decode(v.val);
        }
        catch (e) {
            if (v.flag == 1) {
                d = this.sock["parseNumber"](v.val.toString());
            }
            else if (v.flag == 2) {
                d = Number(v.val.toString());
            }
            else if (v.flag == 3) {
                d = Number(v.val.toString()) ? true : false;
            }
            else {
                d = v.val.toString();
            }
        }
        if (v.hasOwnProperty("cas")) {
            return { val: d, cas: v.cas };
        }
        return d;
    }
}
exports.MemcachedMsgpack = MemcachedMsgpack;
