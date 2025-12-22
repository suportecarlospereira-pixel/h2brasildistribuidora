import React from 'react';

interface LogoProps {
    className?: string;
    showText?: boolean;
    variant?: 'light' | 'dark';
}

export const H2Logo: React.FC<LogoProps> = ({ className = "h-10", showText = true, variant = 'dark' }) => {
    // Colors based on Brazil Flag + Water/Logistics theme
    const green = "#009c3b";
    const yellow = "#ffdf00";
    const blue = "#002776";
    const textFill = variant === 'light' ? '#ffffff' : '#0f172a'; // White or Slate-900

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <svg viewBox="0 0 100 100" className="h-full w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Water Drop Shape (Background) - Blue */}
                <path d="M50 5 C50 5 15 45 15 65 C15 84.33 30.67 100 50 100 C69.33 100 85 84.33 85 65 C85 45 50 5 50 5Z" fill={blue} />
                
                {/* Internal Swoosh (Logistics Road/Path feel) - Green */}
                <path d="M50 20 C50 20 28 50 28 65 C28 75 35 85 45 88 L50 20Z" fill={green} opacity="0.9" />
                
                {/* Accent - Yellow */}
                <path d="M50 20 L55 88 C65 85 72 75 72 65 C72 50 50 20 50 20Z" fill={yellow} opacity="0.9" />
                
                {/* Shine effect */}
                <path d="M65 45 Q 75 55 75 65" stroke="white" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
            </svg>
            
            {showText && (
                <div className="flex flex-col justify-center leading-none">
                    <span className="font-black tracking-tighter text-xl" style={{ color: textFill }}>
                        H2<span style={{ color: green }}>BRASIL</span>
                    </span>
                    <span className="text-[8px] font-bold tracking-[0.2em] uppercase opacity-70" style={{ color: textFill }}>
                        Distribuidora
                    </span>
                </div>
            )}
        </div>
    );
};