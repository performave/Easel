import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart'

export type GroupStat = {
    id: number
    name: string
    pct: number | null
    group_weight: number
}

const chartConfig = {
    pct: { label: 'Grade', color: 'var(--chart-2)' },
} satisfies ChartConfig

/** Horizontal bar chart of per-group percentage scores. */
export const GradeByGroupChart = ({ groups }: { groups: GroupStat[] }) => {
    const data = groups
        .filter(g => g.pct != null)
        .map(g => ({ name: g.name, pct: Number((g.pct as number).toFixed(1)) }))

    if (data.length === 0) return null

    return (
        <Card>
            <CardHeader className='pb-2'>
                <CardTitle className='text-base'>Grade by group</CardTitle>
            </CardHeader>
            <CardContent>
                <ChartContainer
                    config={chartConfig}
                    className='h-[220px] w-full'
                >
                    <BarChart
                        accessibilityLayer
                        data={data}
                        layout='vertical'
                        margin={{ left: 8, right: 16 }}
                    >
                        <CartesianGrid horizontal={false} />
                        <XAxis
                            type='number'
                            domain={[0, 100]}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={v => `${v}%`}
                        />
                        <YAxis
                            type='category'
                            dataKey='name'
                            tickLine={false}
                            axisLine={false}
                            width={120}
                            tick={{ fontSize: 12 }}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent />}
                        />
                        <Bar dataKey='pct' fill='var(--color-pct)' radius={4} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
