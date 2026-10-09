async page => {
 const rpc = async(method,params=[]) => { const r=await page.request.post('http://127.0.0.1:8546',{data:{jsonrpc:'2.0',id:35,method,params}}); const b=await r.json(); if(b.error)throw Error(b.error.message); return b.result; };
 const token='0xa16E02E87b7454126E5E10d957A927A7F5B5d2be',account='0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
 const read=async(data)=>BigInt(await rpc('eth_call',[{to:token,data},'latest']));
 const state=async()=>({supply:(await read('0x18160ddd')).toString(),holdings:(await read('0x70a08231'+account.slice(2).padStart(64,'0'))).toString(),eth:BigInt(await rpc('eth_getBalance',[token,'latest'])).toString(),wallet:BigInt(await rpc('eth_getBalance',[account,'latest'])).toString()});
 const ready=async(name)=>page.waitForFunction(name=>{const b=Array.from(document.querySelectorAll('button')).find(x=>x.textContent===name);return !!b&&!b.disabled;},name);
 const success=async(sell)=>page.getByText(sell?/Sell included in a canonical block/:/Buy included in a canonical block/).first().waitFor({timeout:30000});
 const results=[];
 const capture=async(label,before)=>{const block=await rpc('eth_getBlockByNumber',['latest',true]);const tx=block.transactions.find(x=>x.to?.toLowerCase()===token.toLowerCase()); const receipt=await rpc('eth_getTransactionReceipt',[tx.hash]); if(receipt.status!=='0x1')throw Error('Execution failed'); const after=await state();const gas=BigInt(receipt.gasUsed)*BigInt(receipt.effectiveGasPrice); const ethDelta=BigInt(before.eth)-BigInt(after.eth), walletDelta=BigInt(after.wallet)-BigInt(before.wallet);if(walletDelta+gas!==ethDelta)throw Error('Wallet accounting differs from net ETH plus gas');results.push({label,before,after,hash:tx.hash,gas:gas.toString(),receiptStatus:receipt.status});return after;};
 await page.getByRole('button',{name:'Buy',exact:true}).click();
 await rpc('evm_mine');
 await page.getByLabel('ETH budget including fees').fill('11');await ready('Buy with signed limits');
 let before=await state();await page.getByLabel('ETH budget including fees').press('Enter');await success(false);let after=await capture('cap buy through wallet',before);
 if(BigInt(after.supply)!==10n**24n)throw Error('Cap not reached'); await page.getByText('Supply Cap reached. Buying is unavailable.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Sell',exact:true}).click();
 await page.getByLabel('Token quantity to sell').fill('0.25'); await ready('Sell with signed limits');
 if(!await page.locator('[data-testid="sell-interval"]').count())throw Error('Sell interval unavailable');
 const quoteText=await page.locator('aside').innerText();
 if(!quoteText.includes('0.000004702499')||!quoteText.includes('Signed minimum net ETH')||!quoteText.includes('Endpoint marginal price'))throw Error('Quote detail missing');
 const responsive=[];for(const width of [375,768,1280]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw Error('Horizontal overflow');await page.screenshot({path:`/tmp/issue35-context/sell-${width}.png`,fullPage:true});responsive.push({width,overflow});}
 before=await state(); await page.getByLabel('Token quantity to sell').press('Enter');await success(true); after=await capture('fractional 0.25 token sale',before);
 if(BigInt(before.supply)-BigInt(after.supply)!==250000000000000000n)throw Error('Burn amount mismatch');
 await page.getByRole('button',{name:'Buy',exact:true}).click();await page.getByLabel('ETH budget including fees').fill('1');await ready('Buy with signed limits');
 before=await state();await page.getByRole('button',{name:'Buy with signed limits',exact:true}).click();await success(false);await capture('reopened capacity rebuy',before);
 await page.getByRole('button',{name:'Sell',exact:true}).click();await page.getByLabel('Token quantity to sell').fill('0.000000000000052632');
 await page.getByText('Net proceeds: 0 ETH.',{exact:true}).waitFor();
 if(await page.getByRole('button',{name:'Sell with signed limits',exact:true}).isEnabled())throw Error('Zero output missing confirmation gate');
 before=await state();await page.getByLabel('I confirm burning this token quantity for zero ETH proceeds.').check();await ready('Sell with signed limits');await page.getByRole('button',{name:'Sell with signed limits',exact:true}).click();await success(true);after=await capture('zero net, one wei gross burn explicitly confirmed',before);
 if(BigInt(before.supply)-BigInt(after.supply)!==52632n||after.eth!==before.eth)throw Error('Zero proceeds mismatch');
 await page.getByLabel('Token quantity to sell').fill('1000001');await page.getByText('Insufficient token holdings for this sale.',{exact:true}).waitFor();if(await page.getByRole('button',{name:'Sell with signed limits',exact:true}).isEnabled())throw Error('Insufficient holdings permitted');
 await page.getByLabel('Token quantity to sell').fill('1');await ready('Sell with signed limits');
 await page.getByLabel('Slippage tolerance').selectOption('200');await page.getByText(/You explicitly selected higher tolerance/).waitFor();
 await page.evaluate(()=>window.__issue32Wallet.rejectNextTransaction());before=await state();await page.getByRole('button',{name:'Sell with signed limits',exact:true}).click();await page.getByText(/Sale unsuccessful/).first().waitFor();after=await state();if(before.supply!==after.supply||before.eth!==after.eth)throw Error('Rejected sale changed assets');results.push({label:'wallet rejected sale',before,after});
 await page.getByLabel('Slippage tolerance').selectOption('100');
 await page.evaluate(()=>window.__issue32Wallet.setChain('0x2105'));await page.getByText(/Switch wallet to/).waitFor();if(await page.getByRole('button',{name:'Sell with signed limits',exact:true}).isEnabled())throw Error('Wrong network enabled');await page.evaluate(()=>window.__issue32Wallet.setChain('0x7a69'));await ready('Sell with signed limits');
 // Full funded unwind uses actual wallet-held quantity, preserving accumulated rounding dust and fees.
 before=await state(); const qty=BigInt(before.holdings);const decimal=(qty/10n**18n).toString()+'.'+(qty%10n**18n).toString().padStart(18,'0');
 await page.getByLabel('Token quantity to sell').fill(decimal);await ready('Sell with signed limits');await page.getByRole('button',{name:'Sell with signed limits',exact:true}).click();await success(true);after=await capture('full unwind through wallet',before);if(after.supply!=='0'||after.holdings!=='0')throw Error('Full unwind left tokens');
 await page.getByRole('button',{name:'Buy',exact:true}).click();
 for(let i=0;i<2;i++){await rpc('evm_mine');await page.getByLabel('ETH budget including fees').fill('0.000000000000000002');await page.getByRole('button',{name:'Refresh quote and balances',exact:true}).click();await ready('Buy with signed limits');before=await state();await page.getByRole('button',{name:'Buy with signed limits',exact:true}).click();await success(false);await capture('tiny funded buy '+i,before);}
 await page.getByRole('button',{name:'Sell',exact:true}).click();await page.getByLabel('Token quantity to sell').fill('0.000000000001999998');await page.getByText('Net proceeds: 0 ETH.',{exact:true}).waitFor();if(await page.getByRole('button',{name:'Sell with signed limits',exact:true}).isEnabled())throw Error('Full zero-output unwind enabled');await page.getByLabel('I confirm burning this token quantity for zero ETH proceeds.').check();await ready('Sell with signed limits');before=await state();await page.getByRole('button',{name:'Sell with signed limits',exact:true}).click();await success(true);after=await capture('tiny full unwind explicitly confirmed',before);if(after.supply!=='0'||after.eth!==before.eth)throw Error('Tiny full unwind mismatch');
 const finalText=await page.locator('main').innerText();await page.evaluate(x=>window.issue35Results=x,{results,quoteText,responsive,finalText}); return {results,quoteText,responsive,finalText};
}
