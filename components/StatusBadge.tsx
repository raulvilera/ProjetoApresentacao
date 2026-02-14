import React from 'react';
import { Incident } from '../types';

interface StatusBadgeProps {
    status: Incident['status'];
    size?: 'small' | 'medium' | 'large';
    showLabel?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'medium', showLabel = true }) => {
    const statusConfig = {
        'Pendente': {
            color: 'bg-red-500',
            textColor: 'text-red-600',
            borderColor: 'border-red-200',
            bgLight: 'bg-red-50',
            icon: '🔴',
            label: 'PENDENTE'
        },
        'Em Análise': {
            color: 'bg-yellow-500',
            textColor: 'text-yellow-700',
            borderColor: 'border-yellow-200',
            bgLight: 'bg-yellow-50',
            icon: '🟡',
            label: 'EM ANÁLISE'
        },
        'Resolvido': {
            color: 'bg-green-500',
            textColor: 'text-green-700',
            borderColor: 'border-green-200',
            bgLight: 'bg-green-50',
            icon: '🟢',
            label: 'RESOLVIDO'
        }
    };

    const config = statusConfig[status];

    const sizeClasses = {
        small: 'text-[7px] px-2 py-0.5',
        medium: 'text-[8px] px-3 py-1',
        large: 'text-[9px] px-4 py-1.5'
    };

    return (
        <span
            className={`
        inline-flex items-center gap-1
        ${sizeClasses[size]}
        ${config.bgLight}
        ${config.textColor}
        ${config.borderColor}
        border
        rounded-full
        font-black
        uppercase
        tracking-wider
        shadow-sm
        whitespace-nowrap
      `}
        >
            <span className="text-[10px]">{config.icon}</span>
            {showLabel && <span>{config.label}</span>}
        </span>
    );
};

export default StatusBadge;

