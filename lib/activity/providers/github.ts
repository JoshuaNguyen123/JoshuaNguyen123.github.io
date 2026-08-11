import { withActivityCache } from "../cache.ts";
import type {
  ActivityProviderAdapter,
  DailyProviderActivity,
} from "../types.ts";

interface GitHubContributionResponse {
  data?: {
    user?: {
      contributionsCollection: {
        contributionCalendar: {
          weeks: Array<{
            contributionDays: Array<{
              contributionCount: number;
              date: string;
            }>;
          }>;
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
}

const contributionQuery = `
  query ActivityCalendar($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    }
  }
`;

export const githubActivityAdapter: ActivityProviderAdapter = {
  id: "github",
  async getDailyActivity({ startDate, endDate }) {
    const username = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_TOKEN;
    if (!username || !token) return [];

    return withActivityCache(
      `github:${username}:${startDate}:${endDate}`,
      async (): Promise<DailyProviderActivity[]> => {
        const response = await fetch("https://api.github.com/graphql", {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "engineering-activity-dashboard",
          },
          body: JSON.stringify({
            query: contributionQuery,
            variables: {
              login: username,
              from: `${startDate}T00:00:00Z`,
              to: `${endDate}T23:59:59Z`,
            },
          }),
        });

        if (!response.ok) throw new Error("GitHub activity request failed");
        const payload = (await response.json()) as GitHubContributionResponse;
        if (payload.errors?.length || !payload.data?.user) {
          throw new Error("GitHub activity was unavailable");
        }

        return payload.data.user.contributionsCollection.contributionCalendar.weeks
          .flatMap((week) => week.contributionDays)
          .filter((day) => day.date >= startDate && day.date <= endDate)
          .map((day) => ({
            date: day.date,
            provider: "github",
            value: day.contributionCount,
            unit: "contributions",
            level: 0,
            metadata: { contributions: day.contributionCount },
          }));
      },
    );
  },
};
