import westBengalAdapter from './west_bengal_adapter.js';

class AdapterRegistry {
  constructor() {
    this.adapters = new Map();
    // Register West Bengal reference implementation
    this.registerAdapter(westBengalAdapter);
  }

  registerAdapter(adapterInstance) {
    this.adapters.set(adapterInstance.stateCode, adapterInstance);
    console.log(`🔌 Registered State Adapter Plugin: [${adapterInstance.stateCode}] ${adapterInstance.stateName}`);
  }

  getAdapter(stateCode) {
    return this.adapters.get(stateCode) || null;
  }

  listAdapters() {
    const list = [];
    for (const [code, adapter] of this.adapters.entries()) {
      list.push({
        state_code: code,
        state_name: adapter.stateName,
        is_registered: true,
        type: 'pluggable_plugin'
      });
    }
    return list;
  }
}

export default new AdapterRegistry();
