'use client';

import { useState, useEffect } from 'react';
import { APITesterComponent } from '../components/APITester';

export default function APITesterPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <APITesterComponent />
    </div>
  );
}
