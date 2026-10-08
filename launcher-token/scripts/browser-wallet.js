// Playwright CLI run-code --filename helper. All transactions execute on local Anvil.
async (page) => {
  await page.exposeFunction('__issue32Rpc', async ({method, params = []}) => {
    const response = await page.request.post('http://127.0.0.1:8545', {
      data: {jsonrpc:'2.0', id:1, method, params},
    });
    const body = await response.json();
    // Returning envelope preserves RPC error codes across the Playwright bridge.
    return body;
  });
  await page.addInitScript(() => {
    const listeners = new Map();
    const state = {
      rejectNext: false, chainId: '0x7a69', accountIndex: 0,
      accounts: null, connected: false, requests: [],
    };
    const emit = (event, value) => {
      for (const callback of listeners.get(event) || []) callback(value);
    };
    const rpc = async (method, params = []) => {
      const body = await window.__issue32Rpc({method, params});
      if (body.error) throw Object.assign(new Error(body.error.message), body.error);
      return body.result;
    };
    const accounts = async () => {
      if (!state.accounts) state.accounts = await rpc('eth_accounts');
      return [state.accounts[state.accountIndex]].filter(Boolean);
    };
    const provider = {
      // EIP-6963 generic provider avoids MetaMask SDK-specific requirements.
      isConnected: () => state.connected,
      on(event, callback) {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(callback); return provider;
      },
      removeListener(event, callback) {
        listeners.get(event)?.delete(callback); return provider;
      },
      async request({method, params = []}) {
        state.requests.push({method, params});
        if (method === 'eth_requestAccounts') {
          state.connected = true;
          const value = await accounts();
          emit('connect', {chainId: state.chainId});
          emit('accountsChanged', value);
          return value;
        }
        if (method === 'eth_accounts') return state.connected ? accounts() : [];
        if (method === 'eth_chainId') return state.chainId;
        if (method === 'net_version') return String(parseInt(state.chainId, 16));
        if (method === 'wallet_switchEthereumChain') {
          state.chainId = params[0].chainId;
          emit('chainChanged', state.chainId); return null;
        }
        if (method === 'wallet_addEthereumChain') return null;
        if (method === 'wallet_requestPermissions') {
          state.connected = true;
          return [{parentCapability:'eth_accounts'}];
        }
        if (method === 'wallet_getPermissions') {
          return state.connected ? [{parentCapability:'eth_accounts'}] : [];
        }
        if (method === 'wallet_revokePermissions') {
          state.connected = false; emit('accountsChanged', []); return null;
        }
        if (method === 'eth_sendTransaction' && state.rejectNext) {
          state.rejectNext = false;
          throw Object.assign(new Error('User rejected the request.'), {code:4001});
        }
        if (method === 'eth_sendTransaction' && state.chainId !== '0x7a69') {
          throw Object.assign(new Error('Local harness only sends on Anvil chain 31337.'), {code:4901});
        }
        return rpc(method, params);
      },
    };
    window.ethereum = provider;
    window.__issue32Wallet = {
      state, provider,
      rejectNextTransaction() {state.rejectNext = true;},
      setChain(chainId) {state.chainId = chainId; emit('chainChanged', chainId);},
      async setAccount(index) {
        state.accountIndex = index;
        emit('accountsChanged', await accounts());
      },
      disconnect() {
        state.connected = false;
        emit('accountsChanged', []);
        emit('disconnect', {code:4900,message:'Disconnected'});
      },
    };
    const detail = Object.freeze({
      info: Object.freeze({
        uuid:'11111111-1111-4111-8111-111111111132',
        name:'Local Anvil', rdns:'local.anvil.test',
        icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="%236b8f71"/></svg>',
      }), provider,
    });
    const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {detail}));
    window.addEventListener('eip6963:requestProvider', announce);
    announce();
  });
  return 'Local Anvil EIP-1193 wallet installed for next navigation; no private keys used.';
}
