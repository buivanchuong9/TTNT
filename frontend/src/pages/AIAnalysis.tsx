import { Brain } from 'lucide-react';
import AIApp from '../AIApp';

export default function AIAnalysis() {
  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="page-hero">
        <div className="page-hero-text">
          <div className="page-eyebrow">AI Diagnosis</div>
          <h1>Phân Tích Da Bằng AI</h1>
          <p>Tải lên hình ảnh để nhận đánh giá sơ bộ từ hệ thống trí tuệ nhân tạo của DermaHealth.</p>
        </div>
        <span className="badge badge-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.825rem' }}>
          <Brain size={15} /> AI Diagnosis v2.4
        </span>
      </div>

      <div style={{ marginTop: '-20px' }}>
        <AIApp />
      </div>
    </div>
  );
}
