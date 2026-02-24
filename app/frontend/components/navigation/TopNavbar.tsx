'use client';

import React from 'react';
import { WalletButton } from '@/components/wallet/WalletButton';
import { WalletAddress } from '@/components/wallet/WalletAddress';
import { Menu, Search, Bell } from 'lucide-react';

export const TopNavbar = () => {
    return (
        <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button className="p-2 -ml-2 text-gray-600 dark:text-gray-400 md:hidden">
                        <Menu className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Gatherraa
                    </h1>
                </div>

                <div className="hidden md:flex flex-1 max-w-md items-center relative">
                    <Search className="absolute left-3 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search missions, contributors..."
                        className="w-full bg-gray-100 dark:bg-gray-900 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                    />
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    <button className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors relative">
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-950"></span>
                    </button>
                    <div className="hidden sm:flex items-center gap-3">
                        <WalletAddress />
                    </div>
                    <WalletButton />
                </div>
            </div>
        </header>
    );
};
