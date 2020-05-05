/// <reference types="@fibjs/types" />
import {MemcachedBin} from "./MemcachedBin";
import {MemcachedStr} from "./MemcachedStr";
import {MemcachedJson} from "./MemcachedJson";
import {MemcachedMsgpack} from "./MemcachedMsgpack";

/**
 * memcached客户端实现。
 * 大多数接口-操作过程网络失败会报错(ping除外）。
 * 网络错误默认自动重连。
 */
export {
    MemcachedBin,MemcachedStr,MemcachedJson,MemcachedMsgpack
}
