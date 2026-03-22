/**
 * Карточка особенности с анимацией
 */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  delay?: number;
}

export function FeatureCard({ icon, title, description, delay = 0 }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="group relative bg-cyber-card/50 backdrop-blur-sm border border-cyber-border/30 rounded-xl p-6 hover:border-neon-cyan/30 transition-all duration-300"
    >
      {/* Градиентный hover-эффект */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-neon-cyan/5 to-neon-purple/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Иконка */}
      <div className="relative w-12 h-12 rounded-lg bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 border border-neon-cyan/30 flex items-center justify-center mb-4 group-hover:border-neon-cyan/50 transition-colors">
        <div className="text-neon-cyan group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>

      {/* Контент */}
      <h3 className="relative text-lg font-display font-semibold text-white mb-2">
        {title}
      </h3>
      <p className="relative text-sm text-cyber-muted leading-relaxed">
        {description}
      </p>

      {/* Декоративная линия */}
      <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-neon-cyan/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </motion.div>
  );
}
