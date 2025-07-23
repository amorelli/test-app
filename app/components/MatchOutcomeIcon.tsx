import React from 'react';

interface MatchOutcomeIconProps {
  imageSrc?: string;
  text?: string;
}

const DEFAULT_IMAGE = '../images/teemo-happy.jpg';
const DEFAULT_TEXT = 'Win';

const MatchOutcomeIcon: React.FC<MatchOutcomeIconProps> = ({
  imageSrc = DEFAULT_IMAGE,
  text = DEFAULT_TEXT,
}) => (
  <div
    style={{
      maxWidth: 300,
      maxHeight: 150,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderRadius: 12,
      background: '#f5f5f5',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      padding: 16,
    }}
  >
    <img
      src={imageSrc}
      alt={text}
      style={{
        maxWidth: '100%',
        maxHeight: 80,
        objectFit: 'contain',
        marginBottom: 12,
        borderRadius: 8,
      }}
    />
    <span
      style={{
        fontSize: 32,
        fontWeight: 700,
        color: '#2e7d32',
        textShadow: '1px 2px 8px rgba(0,0,0,0.12)',
        letterSpacing: 2,
        fontFamily: 'Segoe UI, Arial, sans-serif',
      }}
    >
      {text}
    </span>
  </div>
);

export default MatchOutcomeIcon;