import crypto from 'crypto';

/**
 * Mock Service: PFMS (Public Financial Management System) Direct Benefit Transfer (DBT) Gateway
 * Matching Ministry of Finance PFMS live reporting data schema.
 */
export const processPFMSPayment = async ({
  projectId,
  parcelId,
  beneficiaryName,
  accountNumberHash,
  ifscCode,
  amount
}) => {
  const transactionId = `PFMS2026${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const bankRefNo = `UBIN${Math.floor(100000000 + Math.random() * 900000000)}`;

  return {
    status: 'SUCCESS',
    pfms_transaction_id: transactionId,
    bank_reference_number: bankRefNo,
    disbursed_amount: amount,
    beneficiary_status: 'ACCOUNT_VALIDATED_DBT_CREDITED',
    processed_at: new Date().toISOString(),
    pfms_response_code: 'PFMS_00_SUCCESS',
    remarks: 'Direct Benefit Transfer successfully credited under RFCTLARR Act 2013 Statutory Scheme.'
  };
};
