async page => {
 const token='0xa16E02E87b7454126E5E10d957A927A7F5B5d2be',account='0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
 const rpc=async(method,params=[])=>{const r=await page.request.post('http://127.0.0.1:8546',{data:{jsonrpc:'2.0',id:35,method,params}});const b=await r.json();if(b.error)throw Error(b.error.message);return b.result;};
 const word=x=>BigInt(x).toString(16).padStart(64,'0');
 const state=async()=>({supply:BigInt(await rpc('eth_call',[{to:token,data:'0x18160ddd'},'latest'])).toString(),eth:BigInt(await rpc('eth_getBalance',[token,'latest'])).toString(),holdings:BigInt(await rpc('eth_call',[{to:token,data:'0x70a08231'+account.slice(2).padStart(64,'0')},'latest'])).toString()});
 const ready=async(name)=>page.waitForFunction(name=>{const b=Array.from(document.querySelectorAll('button')).find(x=>x.textContent===name);return !!b&&!b.disabled;},name);
 await page.getByRole('button',{name:'Buy',exact:true}).click();await rpc('evm_mine');await page.getByLabel('ETH budget including fees').fill('11');await ready('Buy with signed limits');await page.getByRole('button',{name:'Buy with signed limits',exact:true}).click();await page.getByText(/Buy included in a canonical block/).first().waitFor({timeout:30000});
 const accounts=await rpc('eth_accounts');
 await rpc('eth_sendTransaction',[{from:account,to:token,data:'0xa9059cbb'+accounts[1].slice(2).padStart(64,'0')+word(300000n*10n**18n)}]);
 let raceMode='',baseline,competingHash;
 await page.exposeFunction('__issue35RaceRpc',async({method,params=[]})=>{
  if(method==='eth_sendTransaction'&&raceMode){
   if(raceMode==='minimum')competingHash=await rpc('eth_sendTransaction',[{from:accounts[1],to:token,data:'0xd3c9727c'+word(300000n*10n**18n)+word(0)+word(99999999999n)}]);
   else{await rpc('evm_increaseTime',[301]);await rpc('evm_mine');}
   baseline=await state();raceMode='';params=[{...params[0],gas:'0x1e8480'}];
  }
  const r=await page.request.post('http://127.0.0.1:8546',{data:{jsonrpc:'2.0',id:35,method,params}});return r.json();
 });
 await page.evaluate(()=>window.__issue32Rpc=window.__issue35RaceRpc);
 await page.getByRole('button',{name:'Sell',exact:true}).click();
 const results=[];
 for(const mode of ['minimum','deadline']){
  await page.getByLabel('Token quantity to sell').fill('100000');await page.getByRole('button',{name:'Refresh quote and balances',exact:true}).click();await ready('Sell with signed limits');raceMode=mode;
  await page.getByRole('button',{name:'Sell with signed limits',exact:true}).click();await page.getByText(/Sale unsuccessful/).first().waitFor({timeout:30000});
  const block=await rpc('eth_getBlockByNumber',['latest',true]);const tx=block.transactions.find(x=>x.to?.toLowerCase()===token.toLowerCase());const receipt=await rpc('eth_getTransactionReceipt',[tx.hash]);const after=await state();
  if(receipt.status!=='0x0'||JSON.stringify(after)!==JSON.stringify(baseline))throw Error('Rejected execution changed assets');
  if(await page.getByLabel('Token quantity to sell').inputValue()!=='100000')throw Error('Failure lost input');
  results.push({mode,hash:tx.hash,receiptStatus:receipt.status,baseline,after,competingHash:mode==='minimum'?competingHash:undefined});
 }
 // Recover with a fresh quote instead of weakening the signed minimum.
 await page.getByRole('button',{name:'Refresh quote and balances',exact:true}).click();await ready('Sell with signed limits');await page.getByRole('button',{name:'Sell with signed limits',exact:true}).click();await page.getByText(/Sell included in a canonical block/).first().waitFor({timeout:30000});results.push({mode:'fresh retry succeeds',after:await state()});
 await page.evaluate(()=>window.__issue32Wallet.disconnect());await page.getByText('Connect wallet before trading.',{exact:true}).waitFor();if(await page.getByRole('button',{name:'Sell with signed limits',exact:true}).isEnabled())throw Error('Disconnected sell enabled');
 return {results,disconnectedBlocked:true};
}
