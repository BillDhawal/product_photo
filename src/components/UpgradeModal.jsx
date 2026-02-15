import React from 'react';
import MonetizationOnRounded from '@mui/icons-material/MonetizationOnRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import { useCredits } from '../contexts/CreditsContext';

const CREDIT_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 200,
    price: 9,
    generations: 50,
    description: 'Try paid, small catalogs',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 1000,
    price: 24,
    generations: 250,
    description: 'Regular sellers',
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    credits: 3000,
    price: 59,
    generations: 750,
    description: 'Agencies, bulk catalogs',
    popular: false,
  },
];

export function UpgradeModal() {
  const { showUpgradeModal, setShowUpgradeModal } = useCredits();
  if (!showUpgradeModal) return null;

  const handleBuy = (planId) => {
    // Placeholder: Stripe integration coming soon
    console.log('Buy plan:', planId);
    window.alert(`Stripe checkout for ${planId} coming soon.`);
  };

  return (
    <div className="upgrade-modal-overlay" onClick={() => setShowUpgradeModal(false)}>
      <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="upgrade-modal-close"
          onClick={() => setShowUpgradeModal(false)}
          aria-label="Close"
        >
          <CloseRounded />
        </button>
        <div className="upgrade-modal-header">
          <div className="upgrade-modal-icon">
            <MonetizationOnRounded sx={{ fontSize: 40 }} />
          </div>
          <h2>Get more credits</h2>
          <p>4 credits per generation. Choose a pack that fits your needs.</p>
        </div>
        <div className="upgrade-plans">
          {CREDIT_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`upgrade-plan-card ${plan.popular ? 'popular' : ''}`}
            >
              {plan.popular && (
                <div className="upgrade-plan-badge">Most popular</div>
              )}
              <div className="upgrade-plan-header">
                <h3>{plan.name}</h3>
                <div className="upgrade-plan-price">
                  <span className="amount">${plan.price}</span>
                  <span className="one-time">one-time</span>
                </div>
              </div>
              <ul className="upgrade-plan-features">
                <li>
                  <CheckRounded sx={{ fontSize: 18 }} />
                  <span>{plan.credits.toLocaleString()} credits</span>
                </li>
                <li>
                  <CheckRounded sx={{ fontSize: 18 }} />
                  <span>{plan.generations} generations</span>
                </li>
                <li>
                  <CheckRounded sx={{ fontSize: 18 }} />
                  <span>{plan.description}</span>
                </li>
              </ul>
              <button
                type="button"
                className={`upgrade-plan-cta ${plan.popular ? 'primary' : 'secondary'}`}
                onClick={() => handleBuy(plan.id)}
              >
                Buy now
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
