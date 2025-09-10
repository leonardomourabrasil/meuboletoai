import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export interface StatsCardProps {
  title: string;
  value: string;
  icon: any;
  trend?: {
    value: number;
    label: string;
    absolute?: number; // novo: variação absoluta em reais
  };
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
  subtitle?: string; // novo campo opcional
}

export const StatsCard = ({
  title,
  value,
  icon: Icon,
  trend,
  variant = 'default',
  className = '',
  subtitle
}: StatsCardProps) => {
  const variantClasses = {
    default: 'bg-card border-border',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    destructive: 'bg-red-50 border-red-200',
  } as const;

  const iconColor =
    variant === 'success'
      ? 'text-green-600'
      : variant === 'warning'
      ? 'text-yellow-600'
      : variant === 'destructive'
      ? 'text-red-600'
      : 'text-primary';

  // Regra: aumento (valor positivo) = vermelho; queda (valor negativo) = verde; zero = neutro
  const trendColor = trend
    ? trend.value > 0
      ? 'text-red-600'
      : trend.value < 0
      ? 'text-green-600'
      : 'text-muted-foreground'
    : 'text-muted-foreground';

  const formatCurrencyBRL = (amount: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

  return (
    <Card className={`${variantClasses[variant]} ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>
        )}
        {trend && (
          <p className={`text-xs mt-1 ${trendColor}`}>
            {trend.value > 0 ? '+' : ''}
            {trend.value}%
            {typeof trend.absolute === 'number' && (
              <> ({formatCurrencyBRL(trend.absolute)})</>
            )}
            {' '}{trend.label}
          </p>
        )}
      </CardContent>
    </Card>
  );
}