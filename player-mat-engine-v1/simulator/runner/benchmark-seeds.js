export const BENCHMARK_SEEDS = [
  'bench-001','bench-002','bench-003','bench-004','bench-005',
  'bench-006','bench-007','bench-008','bench-009','bench-010',
  'bench-011','bench-012','bench-013','bench-014','bench-015',
  'bench-016','bench-017','bench-018','bench-019','bench-020',
  'bench-021','bench-022','bench-023','bench-024','bench-025',
  'bench-026','bench-027','bench-028','bench-029','bench-030',
  'bench-031','bench-032','bench-033','bench-034','bench-035',
  'bench-036','bench-037','bench-038','bench-039','bench-040'
];

export function benchmarkSeed(index) {
  return BENCHMARK_SEEDS[index % BENCHMARK_SEEDS.length];
}
