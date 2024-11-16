"use client"

import { pixelify_sans } from '@/app/fonts';

interface AgentDetailsProps {
    ens?: string;
    chain?: string;
    resources?: string[];
}

const AgentDetails = ({ ens, chain, resources = [] }: AgentDetailsProps) => {
    return (
        <div className="bg-card rounded-lg p-4 h-full overflow-hidden shadow">
            <h2 className={`${pixelify_sans.className} text-xl mb-4 text-blue-900`}>Agent Details</h2>

            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-semibold text-blue-900">ENS</h3>
                    <p className="text-sm">{ens || 'Not set'}</p>
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-blue-900">Chain</h3>
                    <p className="text-sm">{chain || 'Not set'}</p>
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-blue-900">Resources</h3>
                    {resources.length > 0 ? (
                        <ul className="text-sm list-disc list-inside">
                            {resources.map((resource, index) => (
                                <li key={index}>{resource}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm">No resources available</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AgentDetails;
