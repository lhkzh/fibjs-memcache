
import {MemcachedStr} from "./MemcachedStr";
//msgpack-编码值
export class MemcachedMsgpack extends MemcachedStr{
    protected encode(d:any):{buf:Class_Buffer, flag:number}{
        return {buf:require("msgpack").encode(d), flag:21};
    }
    protected decode(v:{flag:number, val:Class_Buffer, cas?:string}){
        if(v==null)return null;
        var d;
        try{
            d = require("msgpack").decode(v.val);
        }catch (e) {
            if(v.flag==1){
                d = this.sock["parseNumber"](v.val.toString());
            }else if(v.flag==2){
                d = Number(v.val.toString());
            }else if(v.flag==3){
                d = Number(v.val.toString())?true:false;
            }else{
                d = v.val.toString();
            }
        }
        if(v.hasOwnProperty("cas")){
            return {val:d,cas:v.cas};
        }
        return d;
    }
}
