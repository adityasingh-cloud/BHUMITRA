import { BaseStateAdapter } from './state_adapter_interface.js';

export class WestBengalAdapter extends BaseStateAdapter {
  constructor() {
    super('WB', 'West Bengal (Banglarbhumi Integration)');
  }

  async fetchParcel(khatianPlotNo) {
    // Simulated Banglarbhumi land registry response matching state specific schema
    if (khatianPlotNo.includes('412') || khatianPlotNo.includes('890')) {
      return {
        success: true,
        wb_mouza_name: 'Singur Mouza',
        wb_jl_number: '12',
        wb_khatian_number: '412',
        wb_plot_number: '890',
        wb_classification: 'Nal (Agricultural)',
        wb_land_area_acre: '0.60',
        wb_owner_details: 'Banglarbhumi Verified Title'
      };
    }

    return {
      success: false,
      message: 'Record not found in Banglarbhumi database.'
    };
  }

  mapToCanonical(rawData) {
    return {
      state_code: 'WB',
      district_code: 'WB-HGH',
      village_mouza: `${rawData.wb_mouza_name} JL ${rawData.wb_jl_number}`,
      khatian_plot_no: `Khatian ${rawData.wb_khatian_number} / Plot ${rawData.wb_plot_number}`,
      provenance: 'svamitva_digitised',
      restriction_flags: rawData.wb_classification.includes('Agricultural') ? ['multi_crop_irrigated'] : [],
      current_status: 'clear'
    };
  }

  mapFromCanonical(canonicalData) {
    return {
      wb_mouza_name: canonicalData.village_mouza,
      wb_khatian_number: canonicalData.khatian_plot_no,
      wb_sync_timestamp: new Date().toISOString()
    };
  }
}

export default new WestBengalAdapter();
