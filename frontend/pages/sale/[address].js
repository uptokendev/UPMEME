import { useRouter } from 'next/router';
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite, useBalance } from 'wagmi';
import { useState, useEffect } from 'react';
import Link from 'next/link';

// Minimal ABI for sale contract
const saleAbi = [
  {
    inputs: [],
    name: 'sold',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'tierSize',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'startPrice',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'priceStep',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'bnbIn', type: 'uint256' }],
    name: 'quoteTokensOut',
    outputs: [
      { internalType: 'uint256', name: 'tokensOut', type: 'uint256' },
      { internalType: 'uint256', name: 'bnbUsed', type: 'uint256' },
      { internalType: 'uint256', name: 'tiersCrossed', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'finalized',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'listingPrice',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'audited',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'audit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'minTokensOut', type: 'uint256' }, { internalType: 'uint256', name: 'deadline', type: 'uint256' }],
    name: 'buy',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'finalize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

export default function Sale() {
  const router = useRouter();
  const { address } = router.query;
  const { address: userAddress } = useAccount();
  const [bnbInput, setBnbInput] = useState('');
  const [tokenOut, setTokenOut] = useState('0');

  // read sale data
  const { data: sold } = useContractRead({ address, abi: saleAbi, functionName: 'sold', enabled: !!address });
  const { data: tierSize } = useContractRead({ address, abi: saleAbi, functionName: 'tierSize', enabled: !!address });
  const { data: startPrice } = useContractRead({ address, abi: saleAbi, functionName: 'startPrice', enabled: !!address });
  const { data: priceStep } = useContractRead({ address, abi: saleAbi, functionName: 'priceStep', enabled: !!address });
  const { data: owner } = useContractRead({ address, abi: saleAbi, functionName: 'owner', enabled: !!address });
  const { data: finalized } = useContractRead({ address, abi: saleAbi, functionName: 'finalized', enabled: !!address });
  const { data: listingPrice } = useContractRead({ address, abi: saleAbi, functionName: 'listingPrice', enabled: !!address });
  const { data: audited } = useContractRead({ address, abi: saleAbi, functionName: 'audited', enabled: !!address });

  // compute quote when bnbInput changes
  useEffect(() => {
    const quote = async () => {
      if (!bnbInput || !address) {
        setTokenOut('0');
        return;
      }
      try {
        const wei = String(Math.floor(parseFloat(bnbInput) * 1e18));
        const { result } = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, wei }),
        }).then((res) => res.json());
        setTokenOut(result[0].toString());
      } catch (err) {
        setTokenOut('0');
      }
    };
    quote();
  }, [bnbInput, address]);

  // prepare buy transaction
  const prepareBuy = usePrepareContractWrite({
    address,
    abi: saleAbi,
    functionName: 'buy',
    args: ['0', '0'],
    overrides: {
      value: bnbInput ? String(Math.floor(parseFloat(bnbInput) * 1e18)) : undefined,
    },
    enabled: !!address && !!bnbInput,
  });
  const { write: buy, isLoading: isBuying, isSuccess: buySuccess } = useContractWrite(prepareBuy.config);

  // prepare finalize transaction
  const prepareFinalize = usePrepareContractWrite({
    address,
    abi: saleAbi,
    functionName: 'finalize',
    enabled: !!address && userAddress?.toLowerCase() === owner?.toLowerCase() && !finalized,
  });
  const { write: finalize, isLoading: isFinalizing } = useContractWrite(prepareFinalize.config);

  // prepare audit transaction (for external tokens). Only owner can call when not audited
  const prepareAudit = usePrepareContractWrite({
    address,
    abi: saleAbi,
    functionName: 'audit',
    enabled: !!address && userAddress?.toLowerCase() === owner?.toLowerCase() && !audited,
  });
  const { write: runAudit, isLoading: isAuditing } = useContractWrite(prepareAudit.config);

  return (
    <div>
      {/* Navigation bar */}
      <header className="nav">
        <div className="brand">LaunchIt</div>
        <nav>
          <Link href="/">Home</Link>
          <Link href="/create">Create</Link>
        </nav>
      </header>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#d8d1f1' }}>
          Sale Details
        </h1>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginTop: 0, color: '#d8d1f1' }}>Overview</h2>
          <p style={{ color: '#a89bcf' }}>Address: {address}</p>
          <p style={{ color: '#a89bcf' }}>Sold tokens: {sold ? sold.toString() : '...'}</p>
          <p style={{ color: '#a89bcf' }}>Tier size: {tierSize ? tierSize.toString() : '...'}</p>
          <p style={{ color: '#a89bcf' }}>Start price: {startPrice ? startPrice.toString() : '...'} wei/token</p>
          <p style={{ color: '#a89bcf' }}>Price step per tier: {priceStep ? priceStep.toString() : '...'} wei/token</p>
          {listingPrice && Number(listingPrice) > 0 && (
            <p style={{ color: '#a89bcf' }}>Listing price: {listingPrice.toString()} wei/token</p>
          )}
          <p style={{ color: audited ? '#7dc77d' : '#e07a7a' }}>
            Audit status: {audited ? '✅ Audited' : '❌ Not audited'}
          </p>
        </div>

        {!finalized && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginTop: 0, color: '#d8d1f1' }}>Buy Tokens</h2>
            <label style={{ display: 'block', marginBottom: '1rem' }}>
              <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>BNB Amount</span>
              <input
                type="number"
                min="0"
                value={bnbInput}
                onChange={(e) => setBnbInput(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
              />
            </label>
            <p style={{ color: '#a89bcf' }}>Estimated tokens: {tokenOut}</p>
            <button className="button" onClick={() => buy?.()} disabled={isBuying || !bnbInput}>
              {isBuying ? 'Buying...' : 'Buy'}
            </button>
          </div>
        )}
        {userAddress?.toLowerCase() === owner?.toLowerCase() && !finalized && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginTop: 0, color: '#d8d1f1' }}>Finalize Sale</h2>
            <button className="button" onClick={() => finalize?.()} disabled={isFinalizing}>
              {isFinalizing ? 'Finalizing...' : 'Finalize'}
            </button>
          </div>
        )}

        {userAddress?.toLowerCase() === owner?.toLowerCase() && !audited && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginTop: 0, color: '#d8d1f1' }}>Audit Sale</h2>
            <p style={{ color: '#a89bcf', marginBottom: '1rem' }}>
              Run an on-chain audit to verify sale parameters. This is required for external tokens after
              completing the self-test.
            </p>
            <button className="button" onClick={() => runAudit?.()} disabled={isAuditing}>
              {isAuditing ? 'Auditing...' : 'Run Audit'}
            </button>
          </div>
        )}
        {finalized && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginTop: 0, color: '#d8d1f1' }}>Sale Finalized</h2>
            <p style={{ color: '#a89bcf' }}>
              This sale has been finalized. Liquidity has been added and locked.
            </p>
          </div>
        )}
        <p style={{ marginTop: '1rem', color: '#8e81b6' }}>
          <Link href="/">← Back to launches</Link>
        </p>
      </div>
    </div>
  );
}