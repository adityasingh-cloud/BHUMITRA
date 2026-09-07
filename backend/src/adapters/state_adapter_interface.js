/**
 * Common Pluggable Interface for State Land Records Systems (36 States/UTs)
 */
export class BaseStateAdapter {
  constructor(stateCode, stateName) {
    this.stateCode = stateCode;
    this.stateName = stateName;
  }

  /**
   * Fetch raw parcel record from State portal API
   */
  async fetchParcel(stateSpecificId) {
    throw new Error('fetchParcel method must be implemented by state adapter.');
  }

  /**
   * Map State-specific payload (e.g., Khatian, Mouza, JL Number) to canonical Bhumitra Parcel schema
   */
  mapToCanonical(rawData) {
    throw new Error('mapToCanonical method must be implemented by state adapter.');
  }

  /**
   * Map canonical Bhumitra Parcel schema back to State-specific payload format
   */
  mapFromCanonical(canonicalData) {
    throw new Error('mapFromCanonical method must be implemented by state adapter.');
  }
}
