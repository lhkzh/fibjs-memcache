"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="@fibjs/types" />
const net = require("net");
const io = require("io");
const coroutine = require("coroutine");
const util = require("util");
const URL = require("url");
const B_EOL = Buffer.from("\r\n");
const B_END = Buffer.from("END");
const B_EMPTY = Buffer.from('');
/**
 * 链接memcached客户端。
 */
class MemcachedBin {
    /**
     * @param autoReconnect 是否开启重连
     * @param numberParse 0=number 1=string 2=bigint 3=auto(number/bigint)
     */
    constructor(autoReconnect = true, numberParse = 0) {
        this.stat = 0; //当前链接状态 1：连接可用 2-连接丢失
        this.numberParse = 0; // 0=number 1=string 2=bigint 3=auto(number/bigint)
        this.autoReconnect = autoReconnect;
        this.numberParse = numberParse;
    }
    //关闭连接
    close() {
        this.autoReconnect = false;
        if (this.sock) {
            this.sock.close();
        }
        this.stat = 0;
    }
    /**
     * 通过url建立链接
     * @param url
     */
    connectUrl(url) {
        var arr = shuffle(util.isString(url) ? [url] : url);
        this.urlList = arr;
        for (var i = 0; i < arr.length; i++) {
            var info = URL.parse(arr[i]);
            try {
                return this.connect(info.hostname, Number(info.port)); //如果连接成功就return出去了
            }
            catch (e) {
            }
        }
        throw new Error('connect_err');
    }
    /**
     * 建立链接-失败会抛出错误
     * @param host    主机ip
     * @param port    端口号
     * @param timeout 超时时间ms
     * @throws Error 链接失败抛出错误
     */
    connect(host, port, timeout) {
        host = host || "127.0.0.1";
        port = port || 11211;
        timeout = timeout || 3000;
        this.connectArgs = arguments;
        this.sock = new net.Socket();
        this.sock.timeout = timeout;
        this.sock.connect(host, port);
        this.stream = new io.BufferedStream(this.sock);
        this.stream.EOL = "\r\n";
        this.stat = 1;
        return this;
    }
    /**
     * 重连
     */
    reconnect() {
        if (this.stat != 2) {
            return;
        }
        if (this.waitReOpenEvent != null) {
            this.waitReOpenEvent.wait();
            return;
        }
        var connectArgs = this.connectArgs;
        this.connectArgs = null;
        var evt = new coroutine.Event(false);
        this.waitReOpenEvent = evt;
        var self = this;
        coroutine.start(function () {
            var ok = false;
            for (var i = 0; i < 9999; i++) {
                if (self.stat != 2) {
                    return;
                }
                try {
                    if (self.urlList.length > 1) {
                        self.connectUrl(self.urlList);
                    }
                    else {
                        self.connect(connectArgs[0], connectArgs[1], connectArgs[2]);
                    }
                    ok = true;
                    break;
                }
                catch (e) {
                    coroutine.sleep(Math.ceil(10 + 100 * Math.random()));
                }
            }
            if (!ok) {
                this.connectArgs = connectArgs;
                console.error("io_memcached_reconnect_fail %s", JSON.stringify(connectArgs));
            }
            self.waitReOpenEvent = null;
            evt.set();
        }.bind(this));
    }
    writeLine(s) {
        this.reconnect();
        this.stream.writeLine(s);
    }
    /**
     * 检测链接是否可用
     * @returns boolean
     */
    ping() {
        if (this.stat != 1) {
            return false;
        }
        try {
            this.writeLine("version");
            return this.readHead() != null;
        }
        catch (e) {
            this.on_err(e);
            return false;
        }
    }
    /**
     * 检测链接可用性：不可用抛出错误
     * @throws Error
     */
    check() {
        if (!this.ping())
            throw new Error('io_fail');
    }
    /**
     * 单条获取
     * @param key
     */
    get(key) {
        return this.get_one("get", key);
    }
    /**
     * 单条获取-带cas
     * @param key
     */
    gets(key) {
        return this.get_one("gets", key, true);
    }
    /**
     * 批量获取
     * @param keys
     */
    mget(keys) {
        return this.get_mult("get", keys);
    }
    /**
     * 批量获取-带cas
     * @param keys
     */
    mgets(keys) {
        return this.get_mult("gets", keys, true);
    }
    mset(kvs, lifetime, flags) {
        return this.mstore(kvs, lifetime, flags);
    }
    set(key, val, lifetime, flags) {
        return this.store(-1, "set", key, val, lifetime, flags);
    }
    add(key, val, lifetime, flags) {
        return this.store(-1, "add", key, val, lifetime, flags);
    }
    replace(key, val, lifetime, flags) {
        return this.store(-1, "replace", key, val, lifetime, flags);
    }
    cas(cas, key, value, lifetime, flags) {
        return this.store(cas, 'cas', key, value, lifetime, flags);
    }
    append(key, value, lifetime, flags) {
        return this.store(-1, 'append', key, value, lifetime, flags);
    }
    prepend(key, value, lifetime, flags) {
        return this.store(-1, 'prepend', key, value, lifetime, flags);
    }
    /**
     * 删除
     * @param key
     * @returns number
     */
    del(key) {
        var head = `delete ${key}`;
        try {
            this.writeLine(head);
            return this.readHead() == 'DELETED' ? 1 : 0;
        }
        catch (e) {
            this.on_err(e);
            throw e;
        }
    }
    /**
     * 批量删除
     * @param keys
     * @returns number
     */
    mdel(keys) {
        if (keys.length < 1)
            return 0;
        var n = 0;
        try {
            keys.forEach((k, i) => {
                keys[i] = `delete ${k}\r\n`;
            });
            this.reconnect();
            this.stream.write(Buffer.from(keys.join('')));
            // this.stream.flush();
            var arr = this.stream.readLines(keys.length);
            arr.forEach(e => {
                if (e == 'DELETED') {
                    n++;
                }
            });
            return n;
        }
        catch (e) {
            this.on_err(e);
            throw e;
        }
    }
    /**
     * 递增
     * @param key 操作的key
     * @param num 递增数值
     * @param initVal      如果key不存在，设置初始化值
     * @param initLifeTime 初始化时设置过期时间
     * @returns number
     */
    incr(key, val = 1, initVal = 0, initLifeTime = 0) {
        return this.do_incr('incr', key, val, initVal, initLifeTime);
    }
    /**
     * 递减
     * @param key 操作的key
     * @param num 递减数值
     * @param initVal      如果key不存在，设置初始化值
     * @param initLifeTime 初始化时设置过期时间
     * @returns number
     */
    decr(key, num = 1, initVal = 0, initLifeTime = 0) {
        return this.do_incr('decr', key, num, initVal, initLifeTime);
    }
    /**
     * 判断key是否存在
     * @param key
     * @returns boolean
     */
    exists(key) {
        //https://www.iteye.com/blog/scottina-683063
        //cas key flag exptime bytes version\r\n
        var cmd = `cas ${key} 0 0 0 0\r\n`;
        //NOT_FOUND
        //EXISTS
        try {
            this.writeLine(cmd);
            return this.readHead() == 'EXISTS';
        }
        catch (e) {
            this.on_err(e);
            throw e;
        }
    }
    on_err(e) {
        this.stat = 2;
        if (this.autoReconnect) {
            coroutine.start(this.reconnect.bind(this));
        }
    }
    readHead() {
        var r = this.stream.readLine();
        if (r == null) {
            throw new Error("io_eof");
        }
        else if (r == 'ERROR' || r == 'CLIENT_ERROR') {
            throw new Error(r);
        }
        return r;
    }
    readData(n, readEnd) {
        if (n == 0) {
            // this.stream.readLine();//\r\n
            // this.stream.readLine();//END\r\n
            this.stream.readLines(readEnd ? 2 : 1);
            return B_EMPTY;
        }
        var r = this.stream.read(n);
        if (r == null) {
            throw new Error("io_eof");
        }
        // this.stream.readLine();//this.stream.read(2);//\r\n
        // this.stream.readLine();//END\r\n
        this.stream.readLines(readEnd ? 2 : 1);
        return r;
    }
    get_one(cmd, key, needCas) {
        try {
            this.writeLine(`${cmd} ${key}`);
            var line = this.readHead();
            if (line == 'END') {
                return null;
            }
            var tags = line.split(' ');
            var flag = Number(tags[2]);
            var len = Number(tags[3]);
            var data = this.readData(len, true);
            if (needCas) {
                return { flag: flag, val: data, cas: tags[4] };
            }
            else {
                return { flag: flag, val: data };
            }
        }
        catch (e) {
            this.on_err(e);
            throw e;
        }
    }
    get_mult(cmd, keys, needCas) {
        if (keys.length < 1) {
            return {};
        }
        try {
            var key = keys.join(' ');
            this.writeLine(`${cmd} ${key}`);
            var map = {};
            var ie = keys.length - 1;
            for (var i = 0; i < keys.length; i++) {
                var line = this.readHead();
                if (line == 'END') {
                    break;
                }
                var tags = line.split(' ');
                var key = tags[1];
                var flag = Number(tags[2]);
                var len = Number(tags[3]);
                var data = this.readData(len, i == ie);
                if (needCas) {
                    map[key] = { flag: flag, val: data, cas: tags[4] };
                }
                else {
                    map[key] = { flag: flag, val: data };
                }
            }
            return map;
        }
        catch (e) {
            this.on_err(e);
            throw e;
        }
    }
    mstore(kvs, lifetime, flags) {
        var exp_time = lifetime || 0;
        var arr = [], query, v, n = 0;
        for (var k in kvs) {
            n++;
            v = kvs[k];
            query = ['set', k, flags && flags[k] ? flags[k] : 0, exp_time, v.length, '\r\n'];
            arr.push(Buffer.from(query.join(' ')));
            arr.push(v, B_EOL);
        }
        if (n < 1)
            return true;
        this.reconnect();
        this.stream.write(Buffer.concat(arr));
        this.stream.readLines(n);
        return true;
    }
    store(cas = -1, cmd, key, value, lifetime, flags) {
        var exp_time = lifetime || 0;
        var set_flags = flags || 0;
        var value_len = value.length;
        var query = [cmd, key, set_flags, exp_time, value_len];
        if (cas > -1) {
            query.push(cas);
        }
        var head = query.join(' ');
        try {
            this.writeLine(head);
            this.stream.write(value);
            this.stream.write(B_EOL);
            // this.stream.flush();
            return this.readHead() == 'STORED';
        }
        catch (e) {
            this.on_err(e);
            throw e;
        }
    }
    do_incr(cmd, key, val, initVal, lifeTime) {
        var cmd = `${cmd} ${key} ` + val.toString(10);
        try {
            this.writeLine(cmd);
        }
        catch (e) {
            this.on_err(e);
            throw e;
        }
        var line = this.stream.readLine();
        if (line == null) {
            var e = new Error('io_eof');
            this.on_err(e);
            throw e;
        }
        if (line == 'NOT_FOUND') {
            if (!Number.isFinite(initVal) && typeof initVal != 'bigint') {
                throw new Error('NOT_FOUND_NUM:' + key);
            }
            var suc = this.add(key, Buffer.from(initVal.toString(10)), lifeTime || 0, 2);
            if (suc) {
                return initVal;
            }
            return this.do_incr(cmd, key, val, null, null);
        }
        if (line.endsWith('ERROR')) {
            throw new Error(line + ':' + key);
        }
        return this.parseNumber(line);
    }
    //解析数值
    parseNumber(line) {
        if (this.numberParse == 0) {
            return Number(line);
        }
        else if (this.numberParse == 1) {
            return line;
        }
        else if (this.numberParse == 2) {
            return global["BigInt"](line);
        }
        // var n=Number(line);
        // return Number.isSafeInteger(n) ? n:global["BigInt"](line);
        var n = global["BigInt"](line), m = Number(n);
        return Number.isSafeInteger(m) ? m : n;
    }
}
exports.MemcachedBin = MemcachedBin;
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
