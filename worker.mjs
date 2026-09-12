import { DurableObject } from 'cloudflare:workers';
import { handleApi } from './backend/api.mjs';
export class PortfolioData extends DurableObject {
  constructor(ctx,env){
    super(ctx,env);this.queue=Promise.resolve();
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS portfolio_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    this.store={
      get:key=>{const row=ctx.storage.sql.exec('SELECT value FROM portfolio_state WHERE key = ?',key).toArray()[0];return row?JSON.parse(row.value):undefined;},
      put:(key,value)=>ctx.storage.sql.exec('INSERT INTO portfolio_state (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,JSON.stringify(value))
    };
  }
  async fetch(request){
    const run=this.queue.then(()=>handleApi(request,this.env,this.store,request.headers.get('CF-Connecting-IP')||'unknown'));
    this.queue=run.catch(()=>{});return run;
  }
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/'))return env.PORTFOLIO_DATA.getByName('portfolio').fetch(request);
    return env.ASSETS.fetch(request);
  }
};
