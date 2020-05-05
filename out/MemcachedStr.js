"use strict";
/// <reference types="@fibjs/types" />
Object.defineProperty(exports, "__esModule", { value: true });
const util = require("util");
const MemcachedBin_1 = require("./MemcachedBin");
//字符为主-基本兼容php的Mecached{setOption(\Memcached::OPT_SERIALIZER,\Memcached::SERIALIZER_JSON)}
class MemcachedStr {
    /**
     * @param autoReconnect 是否开启重连
     * @param numberParse  0=number 1=string 2=bigint 3=auto(number/bigint)
     */
    constructor(autoReconnect = true, numberParse = 0) {
        this.sock = new MemcachedBin_1.MemcachedBin(autoReconnect, numberParse);
    }
    connectUrl(url) {
        this.sock.connectUrl(url);
    }
    connect(host, port, timeout) {
        this.sock.connect(host, port, timeout);
        return this;
    }
    reconnect() {
        this.sock.reconnect();
    }
    close() {
        this.sock.close();
    }
    ping() {
        return this.sock.ping();
    }
    check() {
        this.sock.check();
    }
    exists(key) {
        return this.sock.exists(key);
    }
    del(key) {
        return this.sock.del(key);
    }
    mdel(keys) {
        return this.sock.mdel(keys);
    }
    gets(key) {
        return this.get_one("gets", key, true);
    }
    get(key) {
        return this.get_one("get", key);
    }
    mget(keys) {
        return this.get_mult("get", keys);
    }
    mgets(keys) {
        return this.get_mult("gets", keys, true);
    }
    mset(kvs, lifetime) {
        return this.mstore(kvs, lifetime);
    }
    set(key, val, lifetime) {
        return this.store(-1, "set", key, val, lifetime);
    }
    add(key, val, lifetime) {
        return this.store(-1, "add", key, val, lifetime);
    }
    replace(key, val, lifetime) {
        return this.store(-1, "replace", key, val, lifetime);
    }
    cas(cas, key, value, lifetime) {
        return this.store(cas, 'cas', key, value, lifetime);
    }
    /**
     * 向后追加数据
     * @param string key
     * @param string|Buffer value
     * @param number lifetime
     * @param number flags
     * @returns boolean
     */
    append(key, value, lifetime) {
        return this.store(-1, 'append', key, value, lifetime);
    }
    /**
     * 向前追加数据
     * @param string key
     * @param string|Buffer value
     * @param number lifetime
     * @param number flags
     * @returns boolean
     */
    prepend(key, value, lifetime) {
        return this.store(-1, 'prepend', key, value, lifetime);
    }
    /**
     * 递增
     * @param key 操作的key
     * @param num 递增数值
     * @param initVal      如果key不存在，设置初始化值
     * @param initLifeTime 初始化时设置过期时间
     * @returns number|BigInteger
     */
    incr(key, val = 1, initVal = 0, initLifeTime = 0) {
        return this.sock.incr(key, val, initVal, initLifeTime);
    }
    /**
     * 递减
     * @param key 操作的key
     * @param num 递减数值
     * @param initVal      如果key不存在，设置初始化值
     * @param initLifeTime 初始化时设置过期时间
     * @returns number|BigInteger
     */
    decr(key, num = 1, initVal = 0, initLifeTime = 0) {
        return this.sock.decr(key, num, initVal, initLifeTime);
    }
    get_one(cmd, key, needCas) {
        return this.decode(this.sock["get_one"](cmd, key, needCas));
    }
    get_mult(cmd, keys, needCas) {
        if (keys.length < 1) {
            return {};
        }
        var map = this.sock["get_mult"](cmd, keys, needCas);
        for (var k in map) {
            map[k] = this.decode(map[k]);
        }
        return map;
    }
    mstore(kvs, lifetime) {
        var ekvs = {};
        var eflags = {};
        for (var k in kvs) {
            var ec_data = this.encode(kvs[k]);
            ekvs[k] = ec_data.buf;
            eflags[k] = ec_data.flag;
        }
        this.sock.mset(ekvs, lifetime, eflags);
    }
    store(cas = -1, cmd, key, data, lifetime) {
        var ec_data = this.encode(data);
        var value = ec_data.buf;
        var flags = ec_data.flag;
        return this.sock["store"](cas, cmd, key, value, lifetime, flags);
    }
    encode(d) {
        // 0=字符串 1=Int 2=float 3=Boolean 4=Date 9=不管了全部JSON
        if (util.isString(d) || util.isBuffer(d)) {
            return { buf: Buffer.from(d), flag: 0 };
        }
        if (util.isNumber(d)) {
            d = Number(d);
            return { buf: Buffer.from(d.toString()), flag: Number.isInteger(d) ? 1 : 2 };
        }
        else if (typeof d == 'bigint') {
            let n = d;
            return { buf: Buffer.from(n.toString(10)), flag: 1 };
        }
        if (util.isBoolean(d)) {
            return { buf: Buffer.from(d ? "1" : "0"), flag: 3 };
        }
        return this.encodeExt(d);
    }
    encodeExt(d) {
        if (util.isDate(d)) {
            return { buf: Buffer.from(to_dateTime(d)), flag: 0 };
        }
        return { buf: Buffer.from(JSON.stringify(d)), flag: 6 };
    }
    decode(v) {
        if (v == null) {
            return null;
        }
        var d;
        if (v.flag == 0) {
            d = v.val.toString();
        }
        else if (v.flag == 1) {
            d = this.sock["parseNumber"](v.val.toString());
        }
        else if (v.flag == 2) {
            d = Number(v.val.toString());
        }
        else if (v.flag == 3) {
            d = v.val.readInt8() != 0;
        }
        else {
            d = this.decodeExt(v);
        }
        if (v.hasOwnProperty("cas")) {
            return { val: d, cas: v.cas };
        }
        return d;
    }
    decodeExt(v) {
        try {
            return JSON.parse(v.val.toString());
        }
        catch (e) {
            return v.val.toString();
        }
    }
}
exports.MemcachedStr = MemcachedStr;
function to_dateTime(d) {
    return d.getFullYear() + '-' + f2(d.getMonth() + 1) + '-' + f2(d.getDate()) + ' ' + f2(d.getHours()) + ':' + f2(d.getMinutes()) + ':' + f2(d.getSeconds());
}
function f2(n) { return n > 9 ? n : '0' + n; }
