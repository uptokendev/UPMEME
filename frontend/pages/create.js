import { useState } from 'react';
import { useAccount, useConnect, useContractWrite, usePrepareContractWrite } from 'wagmi';
import { bsc, bscTestnet } from 'wagmi/chains';
import Link from 'next/link';

// ABI fragments for Factory and BondingCurveSale
const factoryAbi = [
  {
    inputs: [
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'symbol', type: 'string' },
      {
        components: [
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'uint256', name: 'tierSize', type: 'uint256' },
          { internalType: 'uint256', name: 'startPrice', type: 'uint256' },
          { internalType: 'uint256', name: 'priceStep', type: 'uint256' },
          { internalType: 'uint8', name: 'maxTiersPerTx', type: 'uint8' },
          { internalType: 'uint16', name: 'platformFeeBps', type: 'uint16' },
          { internalType: 'uint256', name: 'endTime', type: 'uint256' },
          { internalType: 'uint256', name: 'hardCapBNB', type: 'uint256' },
          { internalType: 'uint16', name: 'lpPercent', type: 'uint16' },
          { internalType: 'address', name: 'router', type: 'address' },
          { internalType: 'address payable', name: 'treasury', type: 'address' },
          { internalType: 'address payable', name: 'payout', type: 'address' },
          { internalType: 'uint8', name: 'mode', type: 'uint8' },
        ],
        internalType: 'struct BondingCurveSale.InitParams',
        name: 'initParams',
        type: 'tuple',
      },
    ],
    name: 'createLaunch',
    outputs: [
      { internalType: 'address', name: 'tokenAddr', type: 'address' },
      { internalType: 'address', name: 'saleAddr', type: 'address' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'token', type: 'address' },
          { internalType: 'uint256', name: 'tierSize', type: 'uint256' },
          { internalType: 'uint256', name: 'startPrice', type: 'uint256' },
          { internalType: 'uint256', name: 'priceStep', type: 'uint256' },
          { internalType: 'uint8', name: 'maxTiersPerTx', type: 'uint8' },
          { internalType: 'uint16', name: 'platformFeeBps', type: 'uint16' },
          { internalType: 'uint256', name: 'endTime', type: 'uint256' },
          { internalType: 'uint256', name: 'hardCapBNB', type: 'uint256' },
          { internalType: 'uint16', name: 'lpPercent', type: 'uint16' },
          { internalType: 'address', name: 'router', type: 'address' },
          { internalType: 'address payable', name: 'treasury', type: 'address' },
          { internalType: 'address payable', name: 'payout', type: 'address' },
          { internalType: 'uint8', name: 'mode', type: 'uint8' },
        ],
        internalType: 'struct BondingCurveSale.InitParams',
        name: 'initParams',
        type: 'tuple',
      },
    ],
    name: 'createExternalSale',
    outputs: [
      { internalType: 'address', name: 'saleAddr', type: 'address' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

// Replace this with actual factory address after deployment
const FACTORY_ADDRESS = '0xYourFactoryAddress';

export default function Create() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const [form, setForm] = useState({
    tokenName: '',
    tokenSymbol: '',
    externalToken: '',
    tierSize: '1000000000000000000000000', // 1e6 * 1e18 default
    startPrice: '1000000000000', // 0.000001 BNB (1e-6) * 1e18 = 1e12 wei
    priceStep: '100000000000', // 0.0000001 BNB
    maxTiersPerTx: 25,
    platformFeeBps: 50,
    endTime: 0,
    hardCapBNB: 0,
    lpPercent: 6500,
    router: '0x...',
    treasury: '',
    payout: '',
    mode: 0,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const prepareConfig = usePrepareContractWrite({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: form.externalToken ? 'createExternalSale' : 'createLaunch',
    args: form.externalToken
      ? [
          {
            token: form.externalToken,
            tierSize: String(form.tierSize),
            startPrice: String(form.startPrice),
            priceStep: String(form.priceStep),
            maxTiersPerTx: parseInt(form.maxTiersPerTx),
            platformFeeBps: parseInt(form.platformFeeBps),
            endTime: String(form.endTime),
            hardCapBNB: String(form.hardCapBNB),
            lpPercent: parseInt(form.lpPercent),
            router: form.router,
            treasury: form.treasury,
            payout: form.payout,
            mode: parseInt(form.mode),
          },
        ]
      : [
          form.tokenName,
          form.tokenSymbol,
          {
            token: '0x0000000000000000000000000000000000000000',
            tierSize: String(form.tierSize),
            startPrice: String(form.startPrice),
            priceStep: String(form.priceStep),
            maxTiersPerTx: parseInt(form.maxTiersPerTx),
            platformFeeBps: parseInt(form.platformFeeBps),
            endTime: String(form.endTime),
            hardCapBNB: String(form.hardCapBNB),
            lpPercent: parseInt(form.lpPercent),
            router: form.router,
            treasury: form.treasury,
            payout: form.payout,
            mode: parseInt(form.mode),
          },
        ],
  });
  const { data, write, isLoading, isSuccess } = useContractWrite(prepareConfig.config);

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
      {/* Hero */}
      <section className="hero">
        <h1>Create Your Launch</h1>
        <p>
          Configure your token launch parameters, curve settings and addresses. Once
          deployed, your sale will be live on the bonding curve protocol.
        </p>
      </section>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        {!isConnected ? (
          <button className="button" onClick={() => connect({ connector: connectors[0] })}>
            Connect Wallet
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (write) write();
            }}
          >
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', color: '#d8d1f1' }}>Token Information</h2>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>
                  External Token Address (optional)
                </span>
                <input
                  type="text"
                  name="externalToken"
                  value={form.externalToken}
                  onChange={handleChange}
                  className="input"
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                />
              </label>
              {!form.externalToken && (
                <>
                  <label style={{ display: 'block', marginBottom: '1rem' }}>
                    <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>
                      Token Name
                    </span>
                    <input
                      type="text"
                      name="tokenName"
                      value={form.tokenName}
                      onChange={handleChange}
                      required
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                    />
                  </label>
                  <label style={{ display: 'block', marginBottom: '1rem' }}>
                    <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>
                      Symbol
                    </span>
                    <input
                      type="text"
                      name="tokenSymbol"
                      value={form.tokenSymbol}
                      onChange={handleChange}
                      required
                      style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                    />
                  </label>
                </>
              )}
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>Mode</span>
                <select
                  name="mode"
                  value={form.mode}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                >
                  <option value="0">Minter</option>
                  <option value="1">Escrow</option>
                </select>
              </label>
            </div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', color: '#d8d1f1' }}>Bonding Curve Parameters</h2>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>
                  Tier Size (tokens per tier)
                </span>
                <input
                  type="text"
                  name="tierSize"
                  value={form.tierSize}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>Start Price (wei/token)</span>
                <input
                  type="text"
                  name="startPrice"
                  value={form.startPrice}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>Price Step (wei per tier)</span>
                <input
                  type="text"
                  name="priceStep"
                  value={form.priceStep}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>Max Tiers Per Transaction</span>
                <input
                  type="number"
                  name="maxTiersPerTx"
                  value={form.maxTiersPerTx}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>Platform Fee (bps)</span>
                <input
                  type="number"
                  name="platformFeeBps"
                  value={form.platformFeeBps}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>End Time (unix timestamp)</span>
                <input
                  type="number"
                  name="endTime"
                  value={form.endTime}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>Hard Cap (wei BNB)</span>
                <input
                  type="text"
                  name="hardCapBNB"
                  value={form.hardCapBNB}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>LP Percent (basis points)</span>
                <input
                  type="number"
                  name="lpPercent"
                  value={form.lpPercent}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                />
              </label>
            </div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: '1rem', color: '#d8d1f1' }}>Addresses</h2>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>
                  Pancake Router
                </span>
                <input
                  type="text"
                  name="router"
                  value={form.router}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>
                  Treasury (platform fee receiver)
                </span>
                <input
                  type="text"
                  name="treasury"
                  value={form.treasury}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '1rem' }}>
                <span style={{ display: 'block', marginBottom: '0.5rem', color: '#a89bcf' }}>
                  Payout (creator wallet)
                </span>
                <input
                  type="text"
                  name="payout"
                  value={form.payout}
                  onChange={handleChange}
                  required
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '0.4rem', border: '1px solid rgba(139, 92, 246, 0.3)', background: 'rgba(255,255,255,0.05)', color: '#e3e0f5' }}
                />
              </label>
            </div>
            <button className="button" type="submit" disabled={isLoading || isSuccess}>
              {isLoading ? 'Creating...' : isSuccess ? 'Created!' : 'Create Launch'}
            </button>
          </form>
        )}
        <p style={{ marginTop: '2rem', color: '#8e81b6' }}>
          <Link href="/">Back to launches</Link>
        </p>
      </div>
    </div>
  );
}