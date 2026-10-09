async page => {
  await page.exposeFunction('__issue34BeforeSend', async ({mode,tx}) => {
    const rpc=async(method,params=[])=>{
      const response=await page.request.post('http://127.0.0.1:8545',{data:{jsonrpc:'2.0',id:34,method,params}});
      const body=await response.json();
      if(body.error)throw Error(body.error.message);
      return body.result;
    };
    if(await rpc('eth_chainId')!=='0x7a69')throw Error('Local only');
    let raceHash;
    if(mode==='deadline'){
      await rpc('evm_increaseTime',[301]);
      await rpc('evm_mine');
    } else if(mode==='minimum'){
      const accounts=await rpc('eth_accounts');
      const block=await rpc('eth_getBlockByNumber',['latest',false]);
      const deadline=(BigInt(block.timestamp)+300n).toString(16).padStart(64,'0');
      const data=tx.data.slice(0,10)+'0'.repeat(64)+deadline;
      raceHash=await rpc('eth_sendTransaction',[{from:accounts[1],to:tx.to,data,value:'0xde0b6b3a7640000',gas:'0x1e8480'}]);
      const receipt=await rpc('eth_getTransactionReceipt',[raceHash]);
      if(receipt.status!=='0x1')throw Error('Intervening buy failed');
    } else throw Error('Unknown race');
    const supply=await rpc('eth_call',[{to:tx.to,data:'0x18160ddd'},'latest']);
    const eth=await rpc('eth_getBalance',[tx.to,'latest']);
    return {mode,raceHash,supply,eth};
  });
  return 'Anvil-only race actions exposed; install browser-race-bridge.js next';
}
