'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Briefcase, History, User, PlusCircle } from 'lucide-react';

const navItems = [
    { name: 'Home', icon: Home, href: '/dashboard' },
    { name: 'Missions', icon: Briefcase, href: '/dashboard?tab=missions' },
    { name: 'History', icon: History, href: '/dashboard?tab=history' },
    { name: 'Profile', icon: User, href: '/profile' },
];

export const BottomNavbar = () => {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 px-6 py-3 block md:hidden z-50">
            <div className="flex justify-between items-center max-w-md mx-auto">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex flex-col items-center gap-1 transition-colors ${isActive
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            <Icon className="w-6 h-6" />
                            <span className="text-[10px] font-medium">{item.name}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};
