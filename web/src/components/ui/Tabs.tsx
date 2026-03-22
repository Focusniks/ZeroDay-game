/**
 * Tab components для интерфейса
 */
import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: number | string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children?: ReactNode;
}

export function Tabs({ tabs, activeTab, onTabChange, children }: TabsProps) {
  return (
    <div className="w-full">
      {/* Tab headers */}
      <div className="flex gap-1 p-1 bg-cyber-darker/50 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'text-neon-cyan'
                : 'text-cyber-muted hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id
                    ? 'bg-neon-cyan/20 text-neon-cyan'
                    : 'bg-cyber-border/50 text-cyber-muted'
                }`}>
                  {tab.badge}
                </span>
              )}
            </span>
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-cyber-card/80 border border-neon-cyan/30 rounded-lg -z-10"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
          </button>
        ))}
      </div>
      
      {/* Tab content */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Simple tabs without animation */
interface SimpleTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function SimpleTabs({ tabs, activeTab, onTabChange }: SimpleTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-cyber-darker/50 rounded-xl overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`relative px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
            activeTab === tab.id
              ? 'text-neon-cyan'
              : 'text-cyber-muted hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id
                  ? 'bg-neon-cyan/20 text-neon-cyan'
                  : 'bg-cyber-border/50 text-cyber-muted'
              }`}>
                {tab.badge}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
