import React, { useState } from "react";
import { Link } from "react-router-dom";
import HomeIcon from '@mui/icons-material/Home';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import HistoryIcon from '@mui/icons-material/History';
import PaymentsIcon from '@mui/icons-material/Payments';
import RateReviewIcon from '@mui/icons-material/RateReview';

const BottomNav = () => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleNav = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-4">
            {/* Navigation Bar - Floating and Animated */}
            <div className={`
                flex items-center justify-around bg-[#ffffff] border-2 border-[#EEECF0] 
                rounded-full px-4 py-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)]
                transition-all duration-500 ease-in-out transform
                ${isOpen ? 'opacity-100 scale-100 translate-y-0 w-[320px]' : 'opacity-0 scale-50 translate-y-10 w-0 pointer-events-none'}
            `}>
                <Link to="/" className="p-2 text-[#777] hover:text-[#2A174E] hover:bg-white/10 rounded-full transition-all">
                    <PersonAddIcon />
                </Link>
                <Link to="/payroll" className="p-2 text-[#777] hover:text-[#2A174E] hover:bg-white/10 rounded-full transition-all">
                    <HistoryIcon />
                </Link>
                
                {/* Spacer for the toggle button */}
                <div className="w-12 h-12"></div>

                <Link to="/settings" className="p-2 text-[#777] hover:text-[#2A174E] hover:bg-white/10 rounded-full transition-all">
                    <PaymentsIcon />
                </Link>
                <Link to="/profile" className="p-2 text-[#777] hover:text-[#2A174E] hover:bg-white/10 rounded-full transition-all">
                    <RateReviewIcon />
                </Link>
            </div>

            {/* Main Toggle Button (+) */}
            <button 
                onClick={toggleNav}
                className={`
                    absolute bottom-2 left-1/2 -translate-x-1/2
                    w-12 h-12 rounded-full flex items-center justify-center
                    shadow-[0_0_20px_rgba(186,144,233,0.1)]
                    transition-all duration-300 transform active:scale-95
                    ${isOpen ? 'bg-[#2A174E] rotate-45 text-[#FAF2FF]' : 'bg-[#FAF2FF] text-[#2A174E] hover:bg-[#3d2170] hover:border-[#BA90E9] hover:shadow-[0_0_20px_rgba(186,144,233,0.3)] hover:text-[#FAF2FF]'}
                    border-4 border-white
                `}
            >
                <AddIcon sx={{ fontSize: 32 }} />
            </button>
        </div>
    );
};

export default BottomNav;
