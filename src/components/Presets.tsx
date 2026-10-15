import Button from "../ui/Button.tsx";
import {presets} from "../utils/presets.ts";

interface PresetsProps {
    setInputText:(text:string)=>void;
}

export default function Presets({
    setInputText
}:PresetsProps) {

    function setPreset(text:string):void {
        setInputText(text);
    }

    return (
        <div className="flex flex-col gap-2 items-center p-4 border-2 border-indigo-400 rounded-md">
            <h2 className="text-lg font-semibold">Presets</h2>
            <div className="flex flex-wrap gap-2 justify-center">
                <Button
                    text="Load Hibernate N+1 Scenario"
                    variant="danger"
                    className="text-sm"
                    onClick={():void => setPreset(presets.hibernateNPlusOne)}
                />
                <Button
                    text="Load Clean Batch Query"
                    variant="success"
                    className="text-sm"
                    onClick={():void => setPreset(presets.cleanBatch)}
                />
            </div>
        </div>
    );
}