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
      <div className="text-sm text-slate-300 flex items-center gap-1">
        <span>{Math.round(weather.temperature_2m)}°C</span>
        <span className="text-lg">
          {raining ? '🌧️' : cold ? '❄️' : '☀️'}
        </span>
      </div>

      {raining && (
        <div className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded-lg">
          🌧️ גשם בצור הדסה
        </div>
      )}

      {cold && !raining && (
        <div className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-lg">
          🥶 קר בצור הדסה
        </div>
      )}
    </motion.div>
  );
}
