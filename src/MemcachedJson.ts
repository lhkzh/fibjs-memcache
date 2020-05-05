
//JSON-编码值
import {MemcachedStr} from "./MemcachedStr";

export class MemcachedJson extends MemcachedStr{
    protected encode(d:any):{buf:Class_Buffer, flag:number}{
        return {buf:Buffer.from(JSON.stringify(d)), flag:0};
    }
    protected decode(v:{flag:number, val:Class_Buffer, cas?:string}){
        if(v==null)return null;
        var str = v.val.toString();
        var d;
        try{
            d = JSON.parse(str);
        }catch (e) {
            if(v.flag==1){
                d = this.sock["parseNumber"](str);
            }else if(v.flag==2){
                d = Number(str);
            }else if(v.flag==3){
                d = Number(str)?true:false;
            }else{
                d = str;
            }
        }
        if(v.hasOwnProperty("cas")){
            return {val:d,cas:v.cas};
        }
        return d;
    }
}