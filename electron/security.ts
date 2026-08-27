import si from 'systeminformation';
import crypto from 'crypto';

export async function generateHardwareFingerprint(): Promise<string> {
  try {
    // 1. Gather the raw hardware data
    const [baseboard, cpu, disk] = await Promise.all([
      si.baseboard(),
      si.cpu(),
      si.diskLayout()
    ]);

    // 2. Extract the unique serial numbers
    // We fall back to 'unknown' just in case a component hides its serial
    const boardId = baseboard.serial || 'board_unknown';
    const cpuId = cpu.brand || 'cpu_unknown';
    
    // We grab the serial of the first primary hard drive
    const diskId = (disk.length > 0 && disk[0].serialNum) ? disk[0].serialNum : 'disk_unknown';

    // 3. Combine them into a single composite string
    const rawFingerprint = `${boardId}-${cpuId}-${diskId}`;

    // 4. Hash it into a clean, secure SHA-256 UUID
    const secureHash = crypto.createHash('sha256').update(rawFingerprint).digest('hex');
    
    return secureHash;

  } catch (error) {
    console.error('❌ Failed to generate hardware fingerprint:', error);
    throw error;
  }
}