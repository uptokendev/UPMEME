import { ethers } from 'ethers';

// Minimal ABI for quoteTokensOut
const saleAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'bnbIn', type: 'uint256' },
    ],
    name: 'quoteTokensOut',
    outputs: [
      { internalType: 'uint256', name: 'tokensOut', type: 'uint256' },
      { internalType: 'uint256', name: 'bnbUsed', type: 'uint256' },
      { internalType: 'uint256', name: 'tiersCrossed', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }
  try {
    const { address, wei } = req.body;
    if (!address || !wei) {
      res.status(400).json({ error: 'Missing parameters' });
      return;
    }
    // Use BSC RPC or fallback to public provider
    const rpc = process.env.NEXT_PUBLIC_BSC_RPC || 'https://bsc-dataseed.binance.org/';
    const provider = new ethers.JsonRpcProvider(rpc);
    const sale = new ethers.Contract(address, saleAbi, provider);
    const result = await sale.quoteTokensOut(ethers.toBigInt(wei));
    res.status(200).json({ result: [result.tokensOut, result.bnbUsed, result.tiersCrossed] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}