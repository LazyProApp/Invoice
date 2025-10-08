/**
 * CarrierInterface Module
 * Abstract interface for carrier providers
 */

export class CarrierInterface {
  getCarrierConfig(category) {
    throw new Error('Not implemented');
  }

  describeCarrier(code) {
    throw new Error('Not implemented');
  }

  getValidationRules() {
    return {};
  }
}