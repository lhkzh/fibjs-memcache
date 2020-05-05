/// <reference types="@fibjs/types" />

import util=require("util");
import {MemcachedBin} from "./MemcachedBin";

//字符为主-基本兼容php的Mecached{setOption(\Memcached::OPT_SERIALIZER,\Memcached::SERIALIZER_JSON)}
export class MemcachedStr {
    protected sock:MemcachedBin;
    /**
     * @param autoReconnect 是否开启重连
     * @param numberParse  0=number 1=string 2=bigint 3=auto(number/bigint)
     */
    public constructor(autoReconnect:boolean=true, numberParse:number=0){
        this.sock=new MemcachedBin(autoReconnect, numberParse);
    }
    public connectUrl(url:string|string[]){
        this.sock.connectUrl(url);
    }
    public connect(host?:string, port?:number, timeout?:number){
        this.sock.connect(host,port,timeout);
        return this;
    }
    public reconnect(){
        this.sock.reconnect();
    }
    public close(){
        this.sock.close();
    }
    public ping():boolean{
        return this.sock.ping();
    }
    public check(){
        this.sock.check();
    }
    public exists(key:string):boolean{
        return this.sock.exists(key);
    }
    public del(key:string):number{
        return this.sock.del(key);
    }
    public mdel(keys:Array<string>):number{
        return this.sock.mdel(keys);
    }
    public gets(key:string):{val:any, cas:string}{
        return this.get_one("gets", key, true);
    }
    public get(key:string):any{
        return this.get_one("get", key);
    }
    public mget(keys:Array<string>):{[index:string]:any}{
        return this.get_mult("get", keys);
    }
    public mgets(keys:Array<string>):{[index:string]:{val:any, cas:string}}{
        return this.get_mult("gets", keys, true);
    }
    public mset(kvs:any, lifetime?:number){
        return this.mstore(kvs, lifetime);
    }
    public set(key:string, val:any, lifetime?:number){
        return this.store(-1,"set", key, val, lifetime);
    }
    public add(key:string, val:any, lifetime?:number){
        return this.store(-1,"add", key, val, lifetime);
    }
    public replace(key:string, val:any, lifetime?:number){
        return this.store(-1,"replace", key, val, lifetime);
    }
    public cas(cas:number, key:string, value:any, lifetime?:number){
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
    public append(key:string, value:any, lifetime?:number){
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
    public prepend(key:string, value:any, lifetime?:number){
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
    public incr(key:string, val:number=1, initVal=0,initLifeTime=0){
        return this.sock.incr(key,val,initVal,initLifeTime);
    }
    /**
     * 递减
     * @param key 操作的key
     * @param num 递减数值
     * @param initVal      如果key不存在，设置初始化值
     * @param initLifeTime 初始化时设置过期时间
     * @returns number|BigInteger
     */
    public decr(key:string, num:number=1, initVal=0,initLifeTime=0){
        return this.sock.decr(key,num,initVal,initLifeTime);
    }
    private get_one(cmd:string, key:string, needCas?:boolean){
        return this.decode(this.sock["get_one"](cmd, key, needCas));
    }
    private get_mult(cmd:string, keys:Array<string>, needCas?:boolean){
        if(keys.length<1){
            return {};
        }
        var map=this.sock["get_mult"](cmd, keys, needCas);
        for (var k in map){
            map[k]=this.decode(map[k]);
        }
        return map;
    }
    private mstore(kvs:any, lifetime?:number){
        var ekvs={};
        var eflags={};
        for(var k in kvs){
            var ec_data = this.encode(kvs[k]);
            ekvs[k]=ec_data.buf;
            eflags[k]=ec_data.flag;
        }
        this.sock.mset(ekvs, lifetime, eflags);
    }
    private store(cas:number=-1, cmd:string, key:string, data:any, lifetime?:number){
        var ec_data = this.encode(data);
        var value=ec_data.buf;
        var flags=ec_data.flag;
        return this.sock["store"](cas, cmd, key, value, lifetime, flags);
    }
    protected encode(d:any):{buf:Class_Buffer, flag:number}{
        // 0=字符串 1=Int 2=float 3=Boolean 4=Date 9=不管了全部JSON
        if(util.isString(d) || util.isBuffer(d)){
            return {buf:Buffer.from(d), flag:0};
        }
        if(util.isNumber(d)){
            d=Number(d);
            return {buf:Buffer.from(d.toString()), flag:Number.isInteger(d)?1:2};
        }else if(typeof d=='bigint'){
            let n:Number=<any>d;
            return {buf:Buffer.from(n.toString(10)), flag:1};
        }
        if(util.isBoolean(d)){
            return {buf:Buffer.from(d?"1":"0"), flag:3};
        }
        return this.encodeExt(d);
    }
    protected encodeExt(d:any):{buf:Class_Buffer, flag:number}{
        if(util.isDate(d)){
            return {buf:Buffer.from(to_dateTime(d)), flag:0};
        }
        return {buf:Buffer.from(JSON.stringify(d)), flag:6};
    }
    protected decode(v:{flag:number, val:Class_Buffer, cas?:string}){
        if(v==null){
            return null;
        }
        var d:any;
        if(v.flag==0){
            d = v.val.toString();
        }else if(v.flag==1){
            d = this.sock["parseNumber"](v.val.toString());
        }else if(v.flag==2){
            d = Number(v.val.toString());
        }else if(v.flag==3){
            d = v.val.readInt8()!=0;
        }
        else{
            d=this.decodeExt(v);
        }
        if(v.hasOwnProperty("cas")){
            return {val:d,cas:v.cas};
        }
        return d;
    }
    protected decodeExt(v:{flag:number, val:Class_Buffer, cas?:string}){
        try{
            return JSON.parse(v.val.toString());
        }catch (e) {
            return v.val.toString();
        }
    }
}
function to_dateTime(d) {
    return d.getFullYear()+'-'+f2(d.getMonth()+1)+'-'+f2(d.getDate())+' '+f2(d.getHours())+':'+f2(d.getMinutes())+':'+f2(d.getSeconds());
}
function f2(n){return n>9?n:'0'+n;}