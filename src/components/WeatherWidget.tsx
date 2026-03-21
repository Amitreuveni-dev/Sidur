'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fetchWeather, isRaining, isCold } from '@/lib/weather';
import type { WeatherCurrent } from '@/lib/types';

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);

  useEffect(() => {
    fetchWeather().then(setWeather);
  }, []);

  if (!weather) return null;

  const raining = isRaining(weather);
  const cold = isCold(weather);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-end gap-1"
    >
      <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1">
        <span>{Math.round(weather.temperature_2m)}{'\u00B0'}C</span>
        <span className="text-lg">
          {raining ? '\uD83C\uDF27\uFE0F' : cold ? '\u2744\uFE0F' : '\u2600\uFE0F'}
        </span>
      </div>

      {raining && (
        <div className="text-xs bg-red-500/20 text-red-600 dark:text-red-300 px-2 py-1 rounded-lg">
          {'\uD83C\uDF27\uFE0F'} גשם בצור הדסה
        </div>
      )}

      {cold && !raining && (
        <div className="text-xs bg-blue-500/20 text-blue-600 dark:text-blue-300 px-2 py-1 rounded-lg">
          {'\uD83E\uDD76'} קר בצור הדסה
        </div>
      )}
    </motion.div>
  );
}
