export type Severity = {
    level:number,
    name:string
}

export const severities:Severity[] = [
    {
        level: 1,
        name: "Minor"
    },
    {
        level: 2,
        name: "Moderate"
    },
    {
        level: 3,
        name: "Critical"
    }
]

export const severity = {
    level1: severities[0],
    level2: severities[1],
    level3: severities[2]
}

export interface SeverityQueriesCount {
    level1: number,
    level2: number,
    level3: number
}